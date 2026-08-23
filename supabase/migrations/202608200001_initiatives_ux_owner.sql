begin;

alter table public.solicitudes_mejora
  add column if not exists owner_id uuid references auth.users(id) on delete cascade default auth.uid(),
  add column if not exists actor text not null default '',
  add column if not exists necesidad text not null default '',
  add column if not exists beneficio text not null default '',
  add column if not exists modulo_clave text not null default '',
  add column if not exists prioridad text not null default 'Media',
  add column if not exists estado_ciclo text not null default 'En Revision',
  add column if not exists criterios_aceptacion_json jsonb not null default '[]'::jsonb;

ALTER TABLE public.solicitudes_mejora ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

update public.solicitudes_mejora
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

alter table public.solicitudes_mejora
  alter column updated_at set default now(),
  alter column updated_at set not null;

update public.solicitudes_mejora initiative
set owner_id = auth_user.id
from auth.users auth_user
where initiative.owner_id is null
  and lower(initiative.autor_email) = lower(auth_user.email);

update public.solicitudes_mejora
set
  modulo_clave = case when modulo_clave = '' then modulo_afectado else modulo_clave end,
  estado_ciclo = case estado
    when 'Aprobada' then 'Aprobada'
    when 'Declinada' then 'Descartada'
    else 'En Revision'
  end,
  criterios_aceptacion_json = case
    when jsonb_array_length(criterios_aceptacion_json) = 0 and coalesce(criterios_aceptacion, '') <> ''
      then jsonb_build_array(jsonb_build_object(
        'id', 'legacy-' || coalesce(audit_id, id::text),
        'mode', 'checklist',
        'text', criterios_aceptacion,
        'verified', false
      ))
    else criterios_aceptacion_json
  end;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'solicitudes_mejora_prioridad_check') then
    alter table public.solicitudes_mejora add constraint solicitudes_mejora_prioridad_check
      check (prioridad in ('Baja', 'Media', 'Alta', 'Critica'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'solicitudes_mejora_estado_ciclo_check') then
    alter table public.solicitudes_mejora add constraint solicitudes_mejora_estado_ciclo_check
      check (estado_ciclo in ('Borrador', 'En Revision', 'Aprobada', 'En Desarrollo', 'Implementada', 'Descartada'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'solicitudes_mejora_owner_required') then
    alter table public.solicitudes_mejora add constraint solicitudes_mejora_owner_required
      check (owner_id is not null) not valid;
  end if;
end $$;

create index if not exists solicitudes_mejora_owner_updated_idx
  on public.solicitudes_mejora(owner_id, updated_at desc);
create index if not exists solicitudes_mejora_filters_idx
  on public.solicitudes_mejora(estado_ciclo, prioridad, modulo_clave);

create or replace function public.solicitudes_mejora_keep_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.owner_id := old.owner_id;
  return new;
end;
$$;
drop trigger if exists solicitudes_mejora_owner_immutable on public.solicitudes_mejora;
create trigger solicitudes_mejora_owner_immutable
before update of owner_id on public.solicitudes_mejora
for each row execute function public.solicitudes_mejora_keep_owner();

insert into public.permissions(id, modulo, nombre, descripcion, categoria) values
  ('modulo:iniciativas:ver', 'Iniciativas & Mejoras', 'Ver iniciativas', 'Consultar iniciativas permitidas por RLS.', 'pantalla'),
  ('modulo:iniciativas:crear', 'Iniciativas & Mejoras', 'Crear iniciativas', 'Guardar borradores y enviar historias a revisión.', 'accion'),
  ('modulo:iniciativas:editar', 'Iniciativas & Mejoras', 'Editar iniciativas', 'Editar iniciativas propias o, para Admin, cualquier iniciativa.', 'accion'),
  ('modulo:iniciativas:eliminar', 'Iniciativas & Mejoras', 'Eliminar iniciativas', 'Eliminar iniciativas propias o, para Admin, cualquier iniciativa.', 'accion'),
  ('modulo:iniciativas:aprobar', 'Iniciativas & Mejoras', 'Aprobar iniciativas', 'Revisar, aprobar o descartar iniciativas de otros usuarios.', 'accion')
on conflict (id) do update set
  modulo = excluded.modulo, nombre = excluded.nombre,
  descripcion = excluded.descripcion, categoria = excluded.categoria;

insert into public.role_permissions(role_id, permission_id) values
  ('admin', 'modulo:iniciativas:ver'),
  ('admin', 'modulo:iniciativas:crear'),
  ('admin', 'modulo:iniciativas:editar'),
  ('admin', 'modulo:iniciativas:eliminar'),
  ('admin', 'modulo:iniciativas:aprobar')
on conflict do nothing;
insert into public.role_permissions(role_id, permission_id) values
  ('supervisor', 'modulo:iniciativas:ver'),
  ('supervisor', 'modulo:iniciativas:crear'),
  ('supervisor', 'modulo:iniciativas:editar'),
  ('supervisor', 'modulo:iniciativas:eliminar'),
  ('supervisor', 'modulo:iniciativas:aprobar'),
  ('custodio', 'modulo:iniciativas:ver'),
  ('custodio', 'modulo:iniciativas:crear'),
  ('custodio', 'modulo:iniciativas:editar'),
  ('custodio', 'modulo:iniciativas:eliminar'),
  ('colaborador', 'modulo:iniciativas:ver'),
  ('colaborador', 'modulo:iniciativas:crear'),
  ('colaborador', 'modulo:iniciativas:editar'),
  ('colaborador', 'modulo:iniciativas:eliminar')
on conflict do nothing;

-- Admin es un superrol efectivo: conservar el rol garantiza acceso a todo el
-- catálogo actual y futuro, incluso si una asignación explícita quedó rezagada.
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
revoke all on function public.rbac_has_permission(text) from public;
grant execute on function public.rbac_has_permission(text) to authenticated;

do $$
begin
  if (
    select count(*)
    from public.role_permissions
    where role_id = 'admin'
      and permission_id in (
        'modulo:iniciativas:ver',
        'modulo:iniciativas:crear',
        'modulo:iniciativas:editar',
        'modulo:iniciativas:eliminar',
        'modulo:iniciativas:aprobar'
      )
  ) <> 5 then
    raise exception 'No fue posible asignar todos los permisos de iniciativas al rol admin.';
  end if;
end $$;

alter table public.solicitudes_mejora enable row level security;

do $$
declare policy_name text;
begin
  for policy_name in select policyname from pg_policies
    where schemaname = 'public' and tablename = 'solicitudes_mejora'
  loop
    execute format('drop policy if exists %I on public.solicitudes_mejora', policy_name);
  end loop;
end $$;

create policy solicitudes_mejora_select_scoped
  on public.solicitudes_mejora for select to authenticated
  using (
    owner_id = auth.uid()
    or public.rbac_is_admin()
    or public.rbac_has_permission('modulo:iniciativas:aprobar')
  );
create policy solicitudes_mejora_insert_owner
  on public.solicitudes_mejora for insert to authenticated
  with check (
    owner_id = auth.uid()
    and public.rbac_has_permission('modulo:iniciativas:crear')
  );
create policy solicitudes_mejora_update_scoped
  on public.solicitudes_mejora for update to authenticated
  using (
    (owner_id = auth.uid() and public.rbac_has_permission('modulo:iniciativas:editar'))
    or public.rbac_is_admin()
  )
  with check (
    owner_id = auth.uid() or public.rbac_is_admin()
  );
create policy solicitudes_mejora_delete_scoped
  on public.solicitudes_mejora for delete to authenticated
  using (
    (owner_id = auth.uid() and public.rbac_has_permission('modulo:iniciativas:eliminar'))
    or (public.rbac_is_admin() and public.rbac_has_permission('modulo:iniciativas:eliminar'))
  );

revoke all on public.solicitudes_mejora from anon;
grant select, insert, update, delete on public.solicitudes_mejora to authenticated;

create or replace function public.iniciativas_review(
  target_id uuid,
  target_status text,
  review_comment text,
  reviewer_email text,
  reviewer_name text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.rbac_has_permission('modulo:iniciativas:aprobar') then
    raise exception 'No posee permiso para revisar iniciativas.' using errcode = '42501';
  end if;
  if target_status not in ('Aprobada', 'Descartada') then
    raise exception 'Estado de revisión inválido.' using errcode = '23514';
  end if;
  update public.solicitudes_mejora set
    estado = case when target_status = 'Aprobada' then 'Aprobada' else 'Declinada' end,
    estado_ciclo = target_status,
    comentario_supervisor = trim(review_comment),
    supervisor_email = lower(trim(reviewer_email)),
    supervisor_nombre = trim(reviewer_name),
    fecha_revision = now(),
    updated_at = now()
  where id = target_id;
  if not found then raise exception 'La iniciativa indicada no existe.' using errcode = 'P0002'; end if;
end;
$$;
revoke all on function public.iniciativas_review(uuid, text, text, text, text) from public;
grant execute on function public.iniciativas_review(uuid, text, text, text, text) to authenticated;

commit;
