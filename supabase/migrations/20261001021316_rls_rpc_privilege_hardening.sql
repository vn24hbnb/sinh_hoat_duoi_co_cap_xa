-- Restrict the attendance-settings RPC to authenticated users. Supabase project
-- defaults grant EXECUTE to anon independently of the PUBLIC pseudo-role.
revoke execute on function public.get_meeting_ui_settings(uuid) from public, anon;
grant execute on function public.get_meeting_ui_settings(uuid) to authenticated;

-- Avoid evaluating auth.uid() once per row in RLS policies.
drop policy if exists user_read on public.app_users;
create policy user_read on public.app_users for select to authenticated
using(id=(select auth.uid()) or private.can_manage(organization_id));

drop policy if exists audit_insert on public.audit_logs;
create policy audit_insert on public.audit_logs for insert to authenticated
with check(actor_id=(select auth.uid()) and private.is_admin(organization_id));

-- Separate write policies from SELECT policies; this avoids duplicate
-- permissive SELECT policies while preserving the same admin-only writes.
do $$
declare t text;
begin
  foreach t in array array[
    'chi_bos','question_banks','questions','meeting_exams','meeting_exam_banks',
    'meeting_documents','meeting_reports','ui_assets','ui_settings','ui_templates',
    'meeting_ui_settings'
  ] loop
    execute format('drop policy if exists admin_write on public.%I',t);
    execute format('create policy admin_insert on public.%I for insert to authenticated with check(private.is_admin(organization_id))',t);
    execute format('create policy admin_update on public.%I for update to authenticated using(private.is_admin(organization_id)) with check(private.is_admin(organization_id))',t);
    execute format('create policy admin_delete on public.%I for delete to authenticated using(private.is_admin(organization_id))',t);
  end loop;
end $$;

-- Add a covering index only where no existing index already starts with the
-- foreign-key columns. This keeps cascades and tenant joins efficient.
do $$
declare
  fk record;
  index_name text;
  column_list text;
  has_covering_index boolean;
begin
  for fk in
    select c.conrelid as relid,
           n.nspname as schema_name,
           r.relname as table_name,
           c.conname as constraint_name,
           array_agg(a.attname order by k.ordinality) as column_names,
           array_agg(a.attnum::int order by k.ordinality) as column_numbers
    from pg_constraint c
    join pg_class r on r.oid=c.conrelid
    join pg_namespace n on n.oid=r.relnamespace
    cross join unnest(c.conkey) with ordinality as k(attnum,ordinality)
    join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.attnum
    where c.contype='f' and n.nspname='public'
    group by c.conrelid,n.nspname,r.relname,c.conname
  loop
    select exists(
      select 1 from pg_index i
      where i.indrelid=fk.relid and i.indisvalid and i.indisready
        and (select array_agg(k.attnum::int order by k.ordinality)
             from unnest(i.indkey) with ordinality as k(attnum,ordinality)
             where k.ordinality<=cardinality(fk.column_numbers))=fk.column_numbers
    ) into has_covering_index;

    if not has_covering_index then
      select string_agg(format('%I',column_name),', ')
        into column_list
        from unnest(fk.column_names) as c(column_name);
      index_name:=left('fk_'||fk.table_name||'_'||substr(md5(fk.constraint_name),1,8),63);
      execute format('create index if not exists %I on %I.%I (%s)',index_name,fk.schema_name,fk.table_name,column_list);
    end if;
  end loop;
end $$;
