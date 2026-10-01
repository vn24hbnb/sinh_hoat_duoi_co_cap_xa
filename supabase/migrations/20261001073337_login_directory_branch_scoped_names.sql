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
        select jsonb_agg(jsonb_build_object('id',id,'name',name) order by sort_order,name)
        from public.chi_bos
        where organization_id=p_organization_id
          and is_active
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
