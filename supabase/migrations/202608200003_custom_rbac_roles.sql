begin;

-- Los cinco roles base permanecen protegidos. Los administradores autorizados
-- pueden ampliar el catálogo mediante esta RPC sin recibir INSERT directo.
create or replace function public.rbac_create_role(
  target_role_id text,
  target_name text,
  target_description text default ''
)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_id text := lower(trim(coalesce(target_role_id, '')));
  normalized_name text := trim(coalesce(target_name, ''));
begin
  if not public.rbac_has_permission('modulo:admin:gestionar_permisos') then
    raise exception 'No tiene permiso para crear roles.' using errcode = '42501';
  end if;
  if normalized_id !~ '^[a-z][a-z0-9_]{2,49}$' then
    raise exception 'El slug debe iniciar con una letra y contener solo letras minúsculas, números o guion bajo.'
      using errcode = '23514';
  end if;
  if normalized_id in ('master_admin', 'custodio', 'analista', 'colaborador', 'oficial') then
    raise exception 'El slug indicado está reservado para homologación histórica.' using errcode = '23514';
  end if;
  if char_length(normalized_name) < 3 or char_length(normalized_name) > 80 then
    raise exception 'El nombre del rol debe contener entre 3 y 80 caracteres.' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.roles r
    where r.id = normalized_id or lower(r.name) = lower(normalized_name)
  ) then
    raise exception 'Ya existe un rol con ese nombre o identificador.' using errcode = '23505';
  end if;

  insert into public.roles(id, name, description, is_system, updated_at)
  values (normalized_id, normalized_name, trim(coalesce(target_description, '')), false, now());

  return normalized_id;
end;
$$;

-- La matriz admite cualquier rol existente. Admin continúa siendo inmutable y
-- conserva acceso efectivo y explícito al catálogo completo.
create or replace function public.rbac_set_role_permissions(
  target_role_id text,
  target_permission_ids text[]
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.rbac_has_permission('modulo:admin:gestionar_permisos') then
    raise exception 'No tiene permiso para gestionar la matriz RBAC.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.roles where id = target_role_id) then
    raise exception 'El rol indicado no existe.' using errcode = '23503';
  end if;
  if exists (
    select 1 from unnest(coalesce(target_permission_ids, array[]::text[])) requested(id)
    where not exists (select 1 from public.permissions p where p.id = requested.id)
  ) then
    raise exception 'La selección contiene permisos inexistentes.' using errcode = '23503';
  end if;

  delete from public.role_permissions where role_id = target_role_id;
  if target_role_id = 'admin' then
    insert into public.role_permissions(role_id, permission_id)
    select 'admin', id from public.permissions on conflict do nothing;
  else
    insert into public.role_permissions(role_id, permission_id)
    select target_role_id, id
    from unnest(coalesce(target_permission_ids, array[]::text[])) selected(id)
    on conflict do nothing;
  end if;
end;
$$;

-- Los roles personalizados también pueden asignarse a usuarios. Se mantienen
-- la existencia referencial y la protección del último Admin.
create or replace function public.rbac_set_user_roles(
  target_user_id uuid,
  target_role_ids text[]
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  removes_admin boolean;
  admin_count integer;
begin
  if not public.rbac_has_permission('modulo:admin:gestionar_permisos') then
    raise exception 'No tiene permiso para asignar roles.' using errcode = '42501';
  end if;
  if coalesce(array_length(target_role_ids, 1), 0) = 0 then
    raise exception 'Cada usuario debe conservar al menos un rol.' using errcode = '23514';
  end if;
  if exists (
    select 1 from unnest(target_role_ids) requested(id)
    where not exists (select 1 from public.roles r where r.id = requested.id)
  ) then
    raise exception 'La selección contiene roles inexistentes.' using errcode = '23503';
  end if;

  select
    exists(select 1 from public.user_roles where user_id = target_user_id and role_id = 'admin')
      and not ('admin' = any(target_role_ids)),
    (select count(distinct user_id) from public.user_roles where role_id = 'admin')
  into removes_admin, admin_count;
  if removes_admin and admin_count <= 1 then
    raise exception 'No se puede remover el último Admin.' using errcode = '23514';
  end if;

  delete from public.user_roles where user_id = target_user_id;
  insert into public.user_roles(user_id, role_id)
  select target_user_id, id from unnest(target_role_ids) selected(id)
  on conflict do nothing;
end;
$$;

revoke all on function public.rbac_create_role(text, text, text) from public;
revoke all on function public.rbac_set_role_permissions(text, text[]) from public;
revoke all on function public.rbac_set_user_roles(uuid, text[]) from public;
grant execute on function public.rbac_create_role(text, text, text) to authenticated;
grant execute on function public.rbac_set_role_permissions(text, text[]) to authenticated;
grant execute on function public.rbac_set_user_roles(uuid, text[]) to authenticated;

notify pgrst, 'reload schema';

commit;
