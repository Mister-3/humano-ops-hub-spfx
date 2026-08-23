begin;

-- Catálogo definitivo. Los IDs son los slugs canónicos usados por RBAC.
insert into public.roles (id, name, description, is_system) values
  ('admin', 'Admin', 'Administrador de la plataforma con control técnico total y bypass irrestricto.', true),
  ('gerente', 'Gerente', 'Gestión gerencial y visibilidad transversal de KPIs, reportes e iniciativas.', true),
  ('supervisor', 'Supervisor', 'Supervisión operativa directa, aprobaciones y gestión de equipo.', true),
  ('asistente', 'Asistente', 'Apoyo operativo, reportería y custodia de radicaciones.', true),
  ('agente', 'Agente', 'Operador base y colaborador de línea.', true)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  is_system = true,
  updated_at = now();

-- Conserva permisos acumulados antes de retirar los slugs anteriores.
insert into public.role_permissions(role_id, permission_id)
select
  case
    when lower(replace(replace(rp.role_id, ' ', '_'), '-', '_')) in ('master_admin', 'admin') then 'admin'
    when lower(replace(replace(rp.role_id, ' ', '_'), '-', '_')) = 'gerente' then 'gerente'
    when lower(replace(replace(rp.role_id, ' ', '_'), '-', '_')) = 'supervisor' then 'supervisor'
    when lower(replace(replace(rp.role_id, ' ', '_'), '-', '_')) in ('custodio', 'analista', 'asistente') then 'asistente'
    when lower(replace(replace(rp.role_id, ' ', '_'), '-', '_')) in ('colaborador', 'oficial', 'agente') then 'agente'
  end,
  rp.permission_id
from public.role_permissions rp
where lower(replace(replace(rp.role_id, ' ', '_'), '-', '_')) in (
  'master_admin', 'admin', 'gerente', 'supervisor',
  'custodio', 'analista', 'asistente', 'colaborador', 'oficial', 'agente'
)
on conflict do nothing;

-- Conserva asignaciones de usuarios con el mismo mapeo transicional.
insert into public.user_roles(user_id, role_id)
select
  ur.user_id,
  case
    when lower(replace(replace(ur.role_id, ' ', '_'), '-', '_')) in ('master_admin', 'admin') then 'admin'
    when lower(replace(replace(ur.role_id, ' ', '_'), '-', '_')) = 'gerente' then 'gerente'
    when lower(replace(replace(ur.role_id, ' ', '_'), '-', '_')) = 'supervisor' then 'supervisor'
    when lower(replace(replace(ur.role_id, ' ', '_'), '-', '_')) in ('custodio', 'analista', 'asistente') then 'asistente'
    when lower(replace(replace(ur.role_id, ' ', '_'), '-', '_')) in ('colaborador', 'oficial', 'agente') then 'agente'
  end
from public.user_roles ur
where lower(replace(replace(ur.role_id, ' ', '_'), '-', '_')) in (
  'master_admin', 'admin', 'gerente', 'supervisor',
  'custodio', 'analista', 'asistente', 'colaborador', 'oficial', 'agente'
)
on conflict do nothing;

-- La tabla de perfil histórica también queda normalizada a slugs canónicos.
do $$
declare
  constraint_name text;
begin
  if to_regclass('public.usuarios') is not null then
    for constraint_name in
      select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace nsp on nsp.oid = rel.relnamespace
      where nsp.nspname = 'public'
        and rel.relname = 'usuarios'
        and con.contype = 'c'
        and pg_get_constraintdef(con.oid) ilike '%rol%'
    loop
      execute format('alter table public.usuarios drop constraint if exists %I', constraint_name);
    end loop;
    update public.usuarios
    set rol = case
      when lower(replace(replace(coalesce(rol, ''), ' ', '_'), '-', '_')) in ('master_admin', 'admin') then 'admin'
      when lower(replace(replace(coalesce(rol, ''), ' ', '_'), '-', '_')) = 'gerente' then 'gerente'
      when lower(replace(replace(coalesce(rol, ''), ' ', '_'), '-', '_')) = 'supervisor' then 'supervisor'
      when lower(replace(replace(coalesce(rol, ''), ' ', '_'), '-', '_')) in ('custodio', 'analista', 'asistente') then 'asistente'
      else 'agente'
    end;
    alter table public.usuarios add constraint usuarios_rol_check
      check (rol in ('admin', 'gerente', 'supervisor', 'asistente', 'agente'));
  end if;
end $$;

-- Una vez copiadas las relaciones, se retiran todos los roles no canónicos.
delete from public.role_permissions
where role_id not in ('admin', 'gerente', 'supervisor', 'asistente', 'agente');
delete from public.user_roles
where role_id not in ('admin', 'gerente', 'supervisor', 'asistente', 'agente');
delete from public.roles
where id not in ('admin', 'gerente', 'supervisor', 'asistente', 'agente');

-- Separa visualmente Configuración de la seguridad de usuarios.
update public.permissions
set
  modulo = case
    when id in (
      'modulo:admin:gestionar_usuarios',
      'modulo:admin:gestionar_permisos'
    ) then 'Administración de Usuarios'
    else 'Configuración'
  end,
  nombre = case
    when id = 'modulo:admin:ver' then 'Ver Configuración'
    else nombre
  end,
  descripcion = case
    when id = 'modulo:admin:ver' then 'Acceder a parámetros y catálogos operativos.'
    else descripcion
  end
where id like 'modulo:admin:%';

-- Admin recibe siempre el catálogo completo, incluido cualquier permiso nuevo.
insert into public.role_permissions(role_id, permission_id)
select 'admin', id from public.permissions
on conflict do nothing;

-- Gerente: consulta transversal y acciones gerenciales, sin administración técnica RBAC.
insert into public.role_permissions(role_id, permission_id)
select 'gerente', id
from public.permissions
where id in (
  'modulo:dashboard:ver',
  'modulo:evaluacion:ver',
  'modulo:faltas:ver',
  'modulo:faltas:aprobar',
  'modulo:ausencias:ver',
  'modulo:kudos:ver',
  'modulo:kudos:publicar_empleado_mes',
  'modulo:productividad:ver',
  'modulo:ocupacion:ver',
  'modulo:mejoras:ver',
  'modulo:mejoras:aprobar',
  'modulo:iniciativas:ver',
  'modulo:iniciativas:crear',
  'modulo:iniciativas:editar',
  'modulo:iniciativas:aprobar',
  'modulo:end_to_end:ver',
  'modulo:end_to_end:marcar_reportada'
)
on conflict do nothing;

-- Supervisor conserva supervisión, aprobaciones y gestión del equipo.
insert into public.role_permissions(role_id, permission_id)
select 'supervisor', id
from public.permissions
where id in (
  'modulo:dashboard:ver', 'modulo:evaluacion:ver',
  'modulo:faltas:ver', 'modulo:faltas:registrar', 'modulo:faltas:aprobar',
  'modulo:ausencias:ver', 'modulo:ausencias:solicitar',
  'modulo:kudos:ver', 'modulo:kudos:crear', 'modulo:kudos:publicar_empleado_mes',
  'modulo:productividad:ver', 'modulo:productividad:registrar',
  'modulo:ocupacion:ver', 'modulo:ocupacion:registrar',
  'modulo:mejoras:ver', 'modulo:mejoras:crear', 'modulo:mejoras:aprobar',
  'modulo:iniciativas:ver', 'modulo:iniciativas:crear',
  'modulo:iniciativas:editar', 'modulo:iniciativas:eliminar',
  'modulo:iniciativas:aprobar',
  'modulo:end_to_end:ver', 'modulo:end_to_end:importar',
  'modulo:end_to_end:marcar_reportada', 'modulo:end_to_end:gestionar_calendario',
  'modulo:end_to_end:excluir_filas', 'modulo:end_to_end:resolver_conflictos'
)
on conflict do nothing;

-- Asistente consolida los alcances históricos de Analista y Custodio.
insert into public.role_permissions(role_id, permission_id)
select 'asistente', id
from public.permissions
where id in (
  'modulo:dashboard:ver',
  'modulo:faltas:ver', 'modulo:faltas:registrar',
  'modulo:ausencias:ver', 'modulo:ausencias:solicitar',
  'modulo:kudos:ver', 'modulo:kudos:crear',
  'modulo:productividad:ver',
  'modulo:mejoras:ver', 'modulo:mejoras:crear',
  'modulo:iniciativas:ver', 'modulo:iniciativas:crear',
  'modulo:iniciativas:editar', 'modulo:iniciativas:eliminar',
  'modulo:end_to_end:ver', 'modulo:end_to_end:importar',
  'modulo:end_to_end:marcar_reportada', 'modulo:end_to_end:excluir_filas',
  'modulo:end_to_end:resolver_conflictos'
)
on conflict do nothing;

-- Agente conserva el alcance personal del antiguo Colaborador/Oficial.
insert into public.role_permissions(role_id, permission_id)
select 'agente', id
from public.permissions
where id in (
  'modulo:dashboard:ver',
  'modulo:faltas:ver', 'modulo:faltas:registrar',
  'modulo:ausencias:ver', 'modulo:ausencias:solicitar',
  'modulo:kudos:ver', 'modulo:kudos:crear',
  'modulo:mejoras:ver', 'modulo:mejoras:crear',
  'modulo:iniciativas:ver', 'modulo:iniciativas:crear',
  'modulo:iniciativas:editar', 'modulo:iniciativas:eliminar'
)
on conflict do nothing;

create or replace function public.rbac_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role_id = 'admin'
  );
$$;

create or replace function public.rbac_has_permission(permission_code text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.rbac_is_admin() or exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    where ur.user_id = auth.uid()
      and rp.permission_id = permission_code
  );
$$;

-- La respuesta se calcula en vivo. Admin recibe el catálogo completo aunque una
-- relación explícita se encuentre rezagada; catalog_version permite invalidar UI.
create or replace function public.rbac_get_my_access()
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $$
  select jsonb_build_object(
    'roles', coalesce((
      select jsonb_agg(r.id order by r.id)
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and r.id in ('admin', 'gerente', 'supervisor', 'asistente', 'agente')
    ), '[]'::jsonb),
    'permissions', case
      when public.rbac_is_admin() then coalesce((
        select jsonb_agg(p.id order by p.id) from public.permissions p
      ), '[]'::jsonb)
      else coalesce((
        select jsonb_agg(distinct rp.permission_id)
        from public.user_roles ur
        join public.role_permissions rp on rp.role_id = ur.role_id
        where ur.user_id = auth.uid()
      ), '[]'::jsonb)
    end,
    'catalog_version', '202608200002'
  );
$$;

create or replace function public.rbac_list_users()
returns table(user_id uuid, email text, display_name text, role_ids text[])
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    u.id,
    coalesce(u.email, ''),
    coalesce(u.raw_user_meta_data ->> 'display_name', u.email, 'Usuario'),
    coalesce(array_agg(ur.role_id order by ur.role_id)
      filter (where ur.role_id is not null), array[]::text[])
  from auth.users u
  left join public.user_roles ur on ur.user_id = u.id
  where public.rbac_has_permission('modulo:admin:gestionar_usuarios')
     or public.rbac_has_permission('modulo:admin:gestionar_permisos')
  group by u.id, u.email, u.raw_user_meta_data
  order by coalesce(u.email, '');
$$;

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
  if target_role_id not in ('admin', 'gerente', 'supervisor', 'asistente', 'agente') then
    raise exception 'El rol indicado no pertenece al catálogo canónico.' using errcode = '23503';
  end if;
  if exists (
    select 1 from unnest(target_permission_ids) requested(id)
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
    select target_role_id, id from unnest(target_permission_ids) selected(id)
    on conflict do nothing;
  end if;
end;
$$;

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
    where requested.id not in ('admin', 'gerente', 'supervisor', 'asistente', 'agente')
  ) then
    raise exception 'La selección contiene roles fuera del catálogo canónico.' using errcode = '23503';
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

create or replace function public.rbac_assign_default_role()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  legacy_role text;
  mapped_role text := 'agente';
begin
  if to_regclass('public.usuarios') is not null then
    execute 'select rol from public.usuarios where lower(email) = lower($1) limit 1'
      into legacy_role using new.email;
  end if;
  mapped_role := case
    when lower(replace(replace(coalesce(legacy_role, ''), ' ', '_'), '-', '_')) in ('master_admin', 'admin') then 'admin'
    when lower(coalesce(legacy_role, '')) = 'gerente' then 'gerente'
    when lower(coalesce(legacy_role, '')) = 'supervisor' then 'supervisor'
    when lower(coalesce(legacy_role, '')) in ('custodio', 'analista', 'asistente') then 'asistente'
    else 'agente'
  end;
  insert into public.user_roles(user_id, role_id)
  values (new.id, mapped_role)
  on conflict do nothing;
  return new;
end;
$$;

drop policy if exists user_roles_scoped_read on public.user_roles;
create policy user_roles_scoped_read on public.user_roles
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.rbac_is_admin()
    or public.rbac_has_permission('modulo:admin:gestionar_usuarios')
    or public.rbac_has_permission('modulo:admin:gestionar_permisos')
  );

revoke all on function public.rbac_has_permission(text) from public;
revoke all on function public.rbac_is_admin() from public;
revoke all on function public.rbac_get_my_access() from public;
revoke all on function public.rbac_list_users() from public;
revoke all on function public.rbac_set_role_permissions(text, text[]) from public;
revoke all on function public.rbac_set_user_roles(uuid, text[]) from public;
grant execute on function public.rbac_has_permission(text) to authenticated;
grant execute on function public.rbac_is_admin() to authenticated;
grant execute on function public.rbac_get_my_access() to authenticated;
grant execute on function public.rbac_list_users() to authenticated;
grant execute on function public.rbac_set_role_permissions(text, text[]) to authenticated;
grant execute on function public.rbac_set_user_roles(uuid, text[]) to authenticated;

notify pgrst, 'reload schema';

commit;
