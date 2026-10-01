-- Chiềng Lao's supplied roster has no date-of-birth column. Keep that data
-- explicitly unknown instead of inventing a value.
alter table public.members
  alter column date_of_birth drop not null;

-- Normalize whitespace/case and treat a missing DOB as a single identity for
-- a name within one branch. Different branches remain independent.
create unique index if not exists members_roster_normalized_identity_idx
  on public.members (
    organization_id,
    chi_bo_id,
    lower(regexp_replace(trim(full_name), '\s+', ' ', 'g')),
    coalesce(date_of_birth, 'infinity'::date)
  );

create or replace function private.login_directory(p_organization_id uuid,p_chi_bo_id uuid)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
  select jsonb_build_object(
    'organizations',
    coalesce(
      (
        select jsonb_agg(jsonb_build_object('id',id,'name',name,'slug',slug) order by name)
        from public.organizations
        where is_active
      ),
      '[]'::jsonb
    ),
    'chi_bos',
    coalesce(
      (
        select jsonb_agg(jsonb_build_object('id',b.id,'name',b.name) order by b.sort_order,b.name)
        from public.chi_bos b
        where b.organization_id=p_organization_id
          and b.is_active
          and exists (
            select 1 from public.organizations o
            where o.id=b.organization_id and o.is_active
          )
      ),
      '[]'::jsonb
    ),
    'members',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id',m.id,
            'full_name',m.full_name,
            'display_name',
              m.full_name
              || case
                when m.name_count>1 then
                  ' (' || coalesce(
                    to_char(m.date_of_birth,'DD/MM/YYYY'),
                    'ID ' || substr(m.id::text,1,6)
                  ) || ')'
                else ''
              end
          )
          order by m.full_name,m.date_of_birth nulls last,m.id
        )
        from (
          select
            member_row.*,
            count(*) over (partition by member_row.chi_bo_id,member_row.full_name) as name_count
          from public.members member_row
          where member_row.organization_id=p_organization_id
            and member_row.is_active
            and exists (
              select 1 from public.organizations o
              where o.id=member_row.organization_id and o.is_active
            )
        ) m
        join public.chi_bos b
          on b.id=m.chi_bo_id
         and b.organization_id=m.organization_id
        where m.chi_bo_id=p_chi_bo_id
          and b.is_active
      ),
      '[]'::jsonb
    )
  )
$$;
