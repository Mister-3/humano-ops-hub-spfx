begin;

create table if not exists public.roles (
  id text primary key,
  name text not null unique,
  description text not null default '',
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.permissions (
  id text primary key,
  modulo text not null,
  nombre text not null,
  descripcion text not null default '',
  categoria text not null check (categoria in ('pantalla', 'accion')),
  created_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  role_id text not null references public.roles(id) on update cascade on delete cascade,
  permission_id text not null references public.permissions(id) on update cascade on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id text not null references public.roles(id) on update cascade on delete restrict,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create index if not exists role_permissions_permission_idx
  on public.role_permissions(permission_id, role_id);
create index if not exists user_roles_role_idx
  on public.user_roles(role_id, user_id);

insert into public.roles (id, name, description, is_system) values
  ('admin', 'Admin', 'Administración integral del Hub y de su matriz RBAC.', true),
  ('supervisor', 'Supervisor', 'Supervisión operativa, aprobaciones y analítica del equipo.', true),
  ('custodio', 'Custodio', 'Custodia del ciclo End-to-End y seguimiento de SLA.', true),
  ('colaborador', 'Colaborador', 'Acceso personal a registros, reconocimientos y solicitudes.', true)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  is_system = excluded.is_system,
  updated_at = now();

insert into public.permissions (id, modulo, nombre, descripcion, categoria) values
  ('modulo:dashboard:ver', 'Dashboard', 'Ver dashboard', 'Consulta de indicadores generales.', 'pantalla'),
  ('modulo:evaluacion:ver', 'Evaluación', 'Ver evaluación', 'Consulta de evaluación consolidada de rendimiento.', 'pantalla'),
  ('modulo:faltas:ver', 'Faltas', 'Ver faltas', 'Acceso al módulo de faltas y errores operativos.', 'pantalla'),
  ('modulo:faltas:registrar', 'Faltas', 'Registrar faltas', 'Crear faltas, errores y capacitaciones.', 'accion'),
  ('modulo:faltas:aprobar', 'Faltas', 'Aprobar faltas', 'Aprobar o rechazar registros pendientes.', 'accion'),
  ('modulo:ausencias:ver', 'Ausencias', 'Ver ausencias', 'Consultar ausencias y planificación semanal.', 'pantalla'),
  ('modulo:ausencias:solicitar', 'Ausencias', 'Solicitar ausencias', 'Registrar ausencias, vacaciones y días libres.', 'accion'),
  ('modulo:kudos:ver', 'Kudos', 'Ver reconocimientos', 'Consultar Kudos y Empleado del Mes.', 'pantalla'),
  ('modulo:kudos:crear', 'Kudos', 'Registrar Kudo', 'Enviar un reconocimiento a un colaborador.', 'accion'),
  ('modulo:kudos:publicar_empleado_mes', 'Kudos', 'Publicar Empleado del Mes', 'Publicar el reconocimiento mensual.', 'accion'),
  ('modulo:productividad:ver', 'Productividad', 'Ver productividad', 'Consultar el módulo de productividad.', 'pantalla'),
  ('modulo:productividad:registrar', 'Productividad', 'Registrar productividad', 'Crear registros diarios de productividad.', 'accion'),
  ('modulo:productividad:eliminar', 'Productividad', 'Eliminar productividad', 'Eliminar registros mediante confirmación explícita.', 'accion'),
  ('modulo:ocupacion:ver', 'Ocupación', 'Ver ocupación', 'Consultar ocupación de supervisores.', 'pantalla'),
  ('modulo:ocupacion:registrar', 'Ocupación', 'Registrar ocupación', 'Crear registros de llamadas y correos.', 'accion'),
  ('modulo:mejoras:ver', 'Iniciativas y Mejoras', 'Ver iniciativas', 'Consultar iniciativas y solicitudes propias.', 'pantalla'),
  ('modulo:mejoras:crear', 'Iniciativas y Mejoras', 'Crear iniciativas', 'Registrar nuevas historias de usuario.', 'accion'),
  ('modulo:mejoras:aprobar', 'Iniciativas y Mejoras', 'Aprobar iniciativas', 'Aprobar o declinar iniciativas pendientes.', 'accion'),
  ('modulo:end_to_end:ver', 'End-to-End', 'Ver análisis End-to-End', 'Consultar fotografías y métricas propias.', 'pantalla'),
  ('modulo:end_to_end:importar', 'End-to-End', 'Importar reportes', 'Validar y activar fotografías End-to-End.', 'accion'),
  ('modulo:end_to_end:marcar_reportada', 'End-to-End', 'Marcar reportadas', 'Marcar y revertir radicaciones reportadas.', 'accion'),
  ('modulo:end_to_end:gestionar_calendario', 'End-to-End', 'Gestionar calendario', 'Administrar feriados y cierres compartidos.', 'accion'),
  ('modulo:end_to_end:excluir_filas', 'End-to-End', 'Excluir filas', 'Excluir filas críticas con motivo auditado.', 'accion'),
  ('modulo:end_to_end:resolver_conflictos', 'End-to-End', 'Resolver conflictos', 'Resolver fotografías con igual fecha de generación.', 'accion'),
  ('modulo:admin:ver', 'Administración', 'Ver administración', 'Acceder al área administrativa.', 'pantalla'),
  ('modulo:admin:gestionar_catalogos', 'Administración', 'Gestionar catálogos', 'Crear y modificar catálogos y configuración.', 'accion'),
  ('modulo:admin:eliminar_catalogos', 'Administración', 'Eliminar catálogos', 'Eliminar opciones tras confirmación explícita.', 'accion'),
  ('modulo:admin:gestionar_usuarios', 'Administración', 'Gestionar usuarios', 'Aprobar, bloquear y actualizar usuarios.', 'accion'),
  ('modulo:admin:gestionar_permisos', 'Administración', 'Gestionar roles y permisos', 'Actualizar matrices RBAC y asignaciones de usuarios.', 'accion')
on conflict (id) do update set
  modulo = excluded.modulo,
  nombre = excluded.nombre,
  descripcion = excluded.descripcion,
  categoria = excluded.categoria;

-- Admin conserva todo el catálogo, incluyendo permisos futuros al volver a
-- ejecutar una migración que agregue nuevos códigos.
insert into public.role_permissions (role_id, permission_id)
select 'admin', id from public.permissions
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id) values
  ('supervisor', 'modulo:dashboard:ver'),
  ('supervisor', 'modulo:evaluacion:ver'),
  ('supervisor', 'modulo:faltas:ver'),
  ('supervisor', 'modulo:faltas:registrar'),
  ('supervisor', 'modulo:faltas:aprobar'),
  ('supervisor', 'modulo:ausencias:ver'),
  ('supervisor', 'modulo:ausencias:solicitar'),
  ('supervisor', 'modulo:kudos:ver'),
  ('supervisor', 'modulo:kudos:crear'),
  ('supervisor', 'modulo:kudos:publicar_empleado_mes'),
  ('supervisor', 'modulo:productividad:ver'),
  ('supervisor', 'modulo:productividad:registrar'),
  ('supervisor', 'modulo:ocupacion:ver'),
  ('supervisor', 'modulo:ocupacion:registrar'),
  ('supervisor', 'modulo:mejoras:ver'),
  ('supervisor', 'modulo:mejoras:crear'),
  ('supervisor', 'modulo:mejoras:aprobar'),
  ('supervisor', 'modulo:end_to_end:ver'),
  ('supervisor', 'modulo:end_to_end:importar'),
  ('supervisor', 'modulo:end_to_end:marcar_reportada'),
  ('supervisor', 'modulo:end_to_end:gestionar_calendario'),
  ('supervisor', 'modulo:end_to_end:excluir_filas'),
  ('supervisor', 'modulo:end_to_end:resolver_conflictos'),
  ('custodio', 'modulo:dashboard:ver'),
  ('custodio', 'modulo:end_to_end:ver'),
  ('custodio', 'modulo:end_to_end:importar'),
  ('custodio', 'modulo:end_to_end:marcar_reportada'),
  ('custodio', 'modulo:end_to_end:excluir_filas'),
  ('custodio', 'modulo:end_to_end:resolver_conflictos'),
  ('colaborador', 'modulo:dashboard:ver'),
  ('colaborador', 'modulo:faltas:ver'),
  ('colaborador', 'modulo:faltas:registrar'),
  ('colaborador', 'modulo:ausencias:ver'),
  ('colaborador', 'modulo:ausencias:solicitar'),
  ('colaborador', 'modulo:kudos:ver'),
  ('colaborador', 'modulo:kudos:crear'),
  ('colaborador', 'modulo:mejoras:ver'),
  ('colaborador', 'modulo:mejoras:crear')
on conflict do nothing;

-- Evita el bloqueo inicial solicitado: toda identidad Auth que ya existe al
-- aplicar esta migración comienza como Admin y luego puede reasignarse.
insert into public.user_roles (user_id, role_id)
select id, 'admin' from auth.users
on conflict do nothing;

create or replace function public.rbac_has_permission(permission_code text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    where ur.user_id = auth.uid()
      and rp.permission_id = permission_code
  );
$$;

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
      from public.user_roles ur join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
    ), '[]'::jsonb),
    'permissions', coalesce((
      select jsonb_agg(distinct rp.permission_id)
      from public.user_roles ur
      join public.role_permissions rp on rp.role_id = ur.role_id
      where ur.user_id = auth.uid()
    ), '[]'::jsonb)
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
  where public.rbac_has_permission('modulo:admin:gestionar_permisos')
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
  if not exists (select 1 from public.roles where id = target_role_id) then
    raise exception 'El rol indicado no existe.' using errcode = '23503';
  end if;
  if target_role_id = 'admin' and not (
    'modulo:admin:ver' = any(target_permission_ids) and
    'modulo:admin:gestionar_permisos' = any(target_permission_ids)
  ) then
    raise exception 'Admin debe conservar acceso a Administración y RBAC.' using errcode = '23514';
  end if;
  if exists (
    select 1 from unnest(target_permission_ids) requested(id)
    where not exists (select 1 from public.permissions p where p.id = requested.id)
  ) then
    raise exception 'La selección contiene permisos inexistentes.' using errcode = '23503';
  end if;

  delete from public.role_permissions where role_id = target_role_id;
  insert into public.role_permissions(role_id, permission_id)
  select target_role_id, id from unnest(target_permission_ids) selected(id)
  on conflict do nothing;
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
    raise exception 'No se puede remover el último administrador.' using errcode = '23514';
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
  mapped_role text := 'colaborador';
begin
  if to_regclass('public.usuarios') is not null then
    execute 'select rol from public.usuarios where lower(email) = lower($1) limit 1'
      into legacy_role using new.email;
  end if;
  if lower(coalesce(legacy_role, '')) in ('master_admin', 'master admin', 'admin') then
    mapped_role := 'admin';
  elsif lower(coalesce(legacy_role, '')) in ('gerente', 'supervisor') then
    mapped_role := 'supervisor';
  elsif lower(coalesce(legacy_role, '')) = 'custodio' then
    mapped_role := 'custodio';
  end if;
  insert into public.user_roles(user_id, role_id)
  values (new.id, mapped_role)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_assign_rbac on auth.users;
create trigger on_auth_user_created_assign_rbac
after insert on auth.users
for each row execute function public.rbac_assign_default_role();

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;

drop policy if exists roles_authenticated_read on public.roles;
create policy roles_authenticated_read on public.roles
  for select to authenticated using (true);
drop policy if exists permissions_authenticated_read on public.permissions;
create policy permissions_authenticated_read on public.permissions
  for select to authenticated using (true);
drop policy if exists role_permissions_authenticated_read on public.role_permissions;
create policy role_permissions_authenticated_read on public.role_permissions
  for select to authenticated using (true);
drop policy if exists user_roles_scoped_read on public.user_roles;
create policy user_roles_scoped_read on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.rbac_is_admin());

revoke all on public.roles, public.permissions, public.role_permissions,
  public.user_roles from anon;
grant select on public.roles, public.permissions, public.role_permissions to authenticated;
grant select on public.user_roles to authenticated;

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

commit;
