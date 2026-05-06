create or replace function public.admin_users_overview(
  p_search text default null,
  p_limit int default 50,
  p_offset int default 0
) returns table (
  user_id uuid,
  email text,
  full_name text,
  phone text,
  cpf text,
  city text,
  state text,
  created_at timestamptz,
  is_admin boolean,
  orders_count bigint,
  ltv numeric,
  last_order_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_q text := nullif(trim(coalesce(p_search,'')), '');
  v_limit int := greatest(1, least(coalesce(p_limit, 50), 200));
  v_offset int := greatest(0, coalesce(p_offset, 0));
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'forbidden';
  end if;

  return query
  with base as (
    select p.user_id, p.email, p.full_name, p.phone, p.cpf,
           p.address_city as city, p.address_state as state, p.created_at
      from public.profiles p
     where v_q is null
        or p.email ilike '%'||v_q||'%'
        or coalesce(p.full_name,'') ilike '%'||v_q||'%'
        or coalesce(p.phone,'') ilike '%'||v_q||'%'
        or coalesce(p.address_city,'') ilike '%'||v_q||'%'
        or coalesce(p.address_state,'') ilike '%'||v_q||'%'
  ),
  agg as (
    select o.user_id,
           count(*)::bigint as orders_count,
           coalesce(sum(o.total),0)::numeric as ltv,
           max(o.created_at) as last_order_at
      from public.orders o
     where o.status in ('paid','processing','shipped','delivered')
     group by o.user_id
  ),
  total as (select count(*)::bigint as c from base),
  page as (
    select b.*
      from base b
     order by b.created_at desc
     limit v_limit offset v_offset
  )
  select pg.user_id, pg.email, pg.full_name, pg.phone, pg.cpf,
         pg.city, pg.state, pg.created_at,
         exists(select 1 from public.user_roles ur
                 where ur.user_id = pg.user_id and ur.role = 'admin') as is_admin,
         coalesce(a.orders_count, 0) as orders_count,
         coalesce(a.ltv, 0) as ltv,
         a.last_order_at,
         (select c from total) as total_count
    from page pg
    left join agg a on a.user_id = pg.user_id
   order by pg.created_at desc;
end;
$$;

grant execute on function public.admin_users_overview(text,int,int) to authenticated;