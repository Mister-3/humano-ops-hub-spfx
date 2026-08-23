begin;

-- La migración anterior se conserva intacta. Las filas heredadas permanecen
-- disponibles para ser reclamadas únicamente por el mismo correo autenticado.
alter table public.e2e_snapshots
  add column if not exists owner_id uuid references auth.users(id) on delete cascade
  default auth.uid();
alter table public.e2e_rows
  add column if not exists owner_id uuid references auth.users(id) on delete cascade
  default auth.uid();
alter table public.e2e_groups
  add column if not exists owner_id uuid references auth.users(id) on delete cascade
  default auth.uid();
alter table public.e2e_exclusions
  add column if not exists owner_id uuid references auth.users(id) on delete cascade
  default auth.uid();
alter table public.e2e_report_actions
  add column if not exists owner_id uuid references auth.users(id) on delete cascade
  default auth.uid();
alter table public.e2e_version_conflicts
  add column if not exists owner_id uuid references auth.users(id) on delete cascade
  default auth.uid();
alter table public.e2e_presence_events
  add column if not exists owner_id uuid references auth.users(id) on delete cascade
  default auth.uid();

-- Si la identidad ya existe en Supabase Auth, asigna las fotografías heredadas
-- por el correo registrado durante la importación.
update public.e2e_snapshots snapshot
set owner_id = auth_user.id
from auth.users auth_user
where snapshot.owner_id is null
  and lower(snapshot.imported_by) = lower(auth_user.email);

update public.e2e_rows child
set owner_id = snapshot.owner_id
from public.e2e_snapshots snapshot
where child.snapshot_id = snapshot.id
  and child.owner_id is null
  and snapshot.owner_id is not null;
update public.e2e_groups child
set owner_id = snapshot.owner_id
from public.e2e_snapshots snapshot
where child.snapshot_id = snapshot.id
  and child.owner_id is null
  and snapshot.owner_id is not null;
update public.e2e_exclusions child
set owner_id = snapshot.owner_id
from public.e2e_snapshots snapshot
where child.snapshot_id = snapshot.id
  and child.owner_id is null
  and snapshot.owner_id is not null;
update public.e2e_report_actions child
set owner_id = snapshot.owner_id
from public.e2e_snapshots snapshot
where child.snapshot_id = snapshot.id
  and child.owner_id is null
  and snapshot.owner_id is not null;
update public.e2e_presence_events child
set owner_id = snapshot.owner_id
from public.e2e_snapshots snapshot
where child.snapshot_id = snapshot.id
  and child.owner_id is null
  and snapshot.owner_id is not null;
update public.e2e_version_conflicts conflict
set owner_id = snapshot.owner_id
from public.e2e_snapshots snapshot
where conflict.first_snapshot_id = snapshot.id
  and conflict.owner_id is null
  and snapshot.owner_id is not null;

-- NOT VALID conserva datos legacy sin propietario, pero obliga a que toda fila
-- nueva tenga auth.uid(). Las filas legacy sin correspondencia quedan invisibles.
do $$
declare
  table_name text;
  constraint_name text;
begin
  foreach table_name in array array[
    'e2e_snapshots', 'e2e_rows', 'e2e_groups', 'e2e_exclusions',
    'e2e_report_actions', 'e2e_version_conflicts', 'e2e_presence_events'
  ] loop
    constraint_name := table_name || '_owner_required';
    if not exists (
      select 1 from pg_constraint
      where conname = constraint_name
        and conrelid = format('public.%I', table_name)::regclass
    ) then
      execute format(
        'alter table public.%I add constraint %I check (owner_id is not null) not valid',
        table_name,
        constraint_name
      );
    end if;
  end loop;
end $$;

alter table public.e2e_snapshots
  drop constraint if exists e2e_snapshots_file_hash_key;
drop index if exists public.e2e_snapshots_file_hash_key;

create unique index if not exists e2e_snapshots_owner_hash_unique_idx
  on public.e2e_snapshots (owner_id, file_hash)
  where owner_id is not null;
create index if not exists e2e_snapshots_owner_generation_idx
  on public.e2e_snapshots (owner_id, generation_at desc);
create index if not exists e2e_snapshots_owner_retention_idx
  on public.e2e_snapshots (owner_id, imported_at);
create index if not exists e2e_rows_owner_snapshot_idx
  on public.e2e_rows (owner_id, snapshot_id);
create index if not exists e2e_groups_owner_snapshot_idx
  on public.e2e_groups (owner_id, snapshot_id);
create index if not exists e2e_exclusions_owner_snapshot_idx
  on public.e2e_exclusions (owner_id, snapshot_id);
create index if not exists e2e_actions_owner_snapshot_idx
  on public.e2e_report_actions (owner_id, snapshot_id, created_at);
create index if not exists e2e_conflicts_owner_idx
  on public.e2e_version_conflicts (owner_id, created_at desc);
create index if not exists e2e_presence_owner_snapshot_idx
  on public.e2e_presence_events (owner_id, snapshot_id);

-- Revoca la política permisiva anterior y limita cada tabla privada al JWT
-- autenticado. La comprobación se aplica tanto a lectura como a escritura.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'e2e_snapshots', 'e2e_rows', 'e2e_groups', 'e2e_exclusions',
    'e2e_report_actions', 'e2e_version_conflicts', 'e2e_presence_events'
  ] loop
    execute format(
      'drop policy if exists %I on public.%I',
      table_name || '_custom_auth_access',
      table_name
    );
    execute format(
      'drop policy if exists %I on public.%I',
      table_name || '_owner_access',
      table_name
    );
    execute format('revoke all on public.%I from anon', table_name);
    execute format(
      'grant select, insert, update, delete on public.%I to authenticated',
      table_name
    );
  end loop;
end $$;

create policy e2e_snapshots_owner_access
  on public.e2e_snapshots for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy e2e_rows_owner_access
  on public.e2e_rows for all to authenticated
  using (
    owner_id = auth.uid() and exists (
      select 1 from public.e2e_snapshots snapshot
      where snapshot.id = e2e_rows.snapshot_id
        and snapshot.owner_id = auth.uid()
    )
  )
  with check (
    owner_id = auth.uid() and exists (
      select 1 from public.e2e_snapshots snapshot
      where snapshot.id = e2e_rows.snapshot_id
        and snapshot.owner_id = auth.uid()
    )
  );

create policy e2e_groups_owner_access
  on public.e2e_groups for all to authenticated
  using (
    owner_id = auth.uid() and exists (
      select 1 from public.e2e_snapshots snapshot
      where snapshot.id = e2e_groups.snapshot_id
        and snapshot.owner_id = auth.uid()
    )
  )
  with check (
    owner_id = auth.uid() and exists (
      select 1 from public.e2e_snapshots snapshot
      where snapshot.id = e2e_groups.snapshot_id
        and snapshot.owner_id = auth.uid()
    )
  );

create policy e2e_exclusions_owner_access
  on public.e2e_exclusions for all to authenticated
  using (
    owner_id = auth.uid() and exists (
      select 1 from public.e2e_snapshots snapshot
      where snapshot.id = e2e_exclusions.snapshot_id
        and snapshot.owner_id = auth.uid()
    )
  )
  with check (
    owner_id = auth.uid() and exists (
      select 1 from public.e2e_snapshots snapshot
      where snapshot.id = e2e_exclusions.snapshot_id
        and snapshot.owner_id = auth.uid()
    )
  );

create policy e2e_report_actions_owner_access
  on public.e2e_report_actions for all to authenticated
  using (
    owner_id = auth.uid() and exists (
      select 1 from public.e2e_snapshots snapshot
      where snapshot.id = e2e_report_actions.snapshot_id
        and snapshot.owner_id = auth.uid()
    )
  )
  with check (
    owner_id = auth.uid() and exists (
      select 1 from public.e2e_snapshots snapshot
      where snapshot.id = e2e_report_actions.snapshot_id
        and snapshot.owner_id = auth.uid()
    )
  );

create policy e2e_presence_events_owner_access
  on public.e2e_presence_events for all to authenticated
  using (
    owner_id = auth.uid() and exists (
      select 1 from public.e2e_snapshots snapshot
      where snapshot.id = e2e_presence_events.snapshot_id
        and snapshot.owner_id = auth.uid()
    )
  )
  with check (
    owner_id = auth.uid() and exists (
      select 1 from public.e2e_snapshots snapshot
      where snapshot.id = e2e_presence_events.snapshot_id
        and snapshot.owner_id = auth.uid()
    ) and (
      previous_snapshot_id is null or exists (
        select 1 from public.e2e_snapshots previous_snapshot
        where previous_snapshot.id = e2e_presence_events.previous_snapshot_id
          and previous_snapshot.owner_id = auth.uid()
      )
    )
  );

create policy e2e_version_conflicts_owner_access
  on public.e2e_version_conflicts for all to authenticated
  using (
    owner_id = auth.uid() and exists (
      select 1 from public.e2e_snapshots first_snapshot
      where first_snapshot.id = e2e_version_conflicts.first_snapshot_id
        and first_snapshot.owner_id = auth.uid()
    ) and exists (
      select 1 from public.e2e_snapshots candidate_snapshot
      where candidate_snapshot.id = e2e_version_conflicts.candidate_snapshot_id
        and candidate_snapshot.owner_id = auth.uid()
    )
  )
  with check (
    owner_id = auth.uid() and exists (
      select 1 from public.e2e_snapshots first_snapshot
      where first_snapshot.id = e2e_version_conflicts.first_snapshot_id
        and first_snapshot.owner_id = auth.uid()
    ) and exists (
      select 1 from public.e2e_snapshots candidate_snapshot
      where candidate_snapshot.id = e2e_version_conflicts.candidate_snapshot_id
        and candidate_snapshot.owner_id = auth.uid()
    )
  );

-- Calendario y alias son configuraciones globales compartidas. No contienen
-- fotografías ni memoria operativa de usuarios.
drop policy if exists e2e_cancellation_aliases_custom_auth_access
  on public.e2e_cancellation_aliases;
drop policy if exists e2e_cancellation_aliases_shared_read
  on public.e2e_cancellation_aliases;
drop policy if exists e2e_cancellation_aliases_shared_write
  on public.e2e_cancellation_aliases;
create policy e2e_cancellation_aliases_shared_read
  on public.e2e_cancellation_aliases for select
  to anon, authenticated using (true);
create policy e2e_cancellation_aliases_shared_write
  on public.e2e_cancellation_aliases for all
  to authenticated using (true) with check (true);

drop policy if exists e2e_non_working_periods_custom_auth_access
  on public.e2e_non_working_periods;
drop policy if exists e2e_non_working_periods_shared_read
  on public.e2e_non_working_periods;
drop policy if exists e2e_non_working_periods_shared_write
  on public.e2e_non_working_periods;
create policy e2e_non_working_periods_shared_read
  on public.e2e_non_working_periods for select
  to anon, authenticated using (true);
create policy e2e_non_working_periods_shared_write
  on public.e2e_non_working_periods for all
  to authenticated using (true) with check (true);

grant select on public.e2e_cancellation_aliases to anon, authenticated;
grant insert, update, delete on public.e2e_cancellation_aliases to authenticated;
grant select on public.e2e_non_working_periods to anon, authenticated;
grant insert, update, delete on public.e2e_non_working_periods to authenticated;

-- Reclamo tardío y seguro para cuentas Supabase Auth creadas después de esta
-- migración. Solo toma filas cuyo imported_by coincide con el email del JWT.
create or replace function public.e2e_claim_legacy_snapshots()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_owner uuid := auth.uid();
  current_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if current_owner is null or current_email = '' then
    raise exception 'Se requiere una sesión autenticada.';
  end if;

  update public.e2e_snapshots
  set owner_id = current_owner
  where owner_id is null and lower(imported_by) = current_email;

  update public.e2e_rows child set owner_id = snapshot.owner_id
  from public.e2e_snapshots snapshot
  where child.snapshot_id = snapshot.id and child.owner_id is null
    and snapshot.owner_id = current_owner;
  update public.e2e_groups child set owner_id = snapshot.owner_id
  from public.e2e_snapshots snapshot
  where child.snapshot_id = snapshot.id and child.owner_id is null
    and snapshot.owner_id = current_owner;
  update public.e2e_exclusions child set owner_id = snapshot.owner_id
  from public.e2e_snapshots snapshot
  where child.snapshot_id = snapshot.id and child.owner_id is null
    and snapshot.owner_id = current_owner;
  update public.e2e_report_actions child set owner_id = snapshot.owner_id
  from public.e2e_snapshots snapshot
  where child.snapshot_id = snapshot.id and child.owner_id is null
    and snapshot.owner_id = current_owner;
  update public.e2e_presence_events child set owner_id = snapshot.owner_id
  from public.e2e_snapshots snapshot
  where child.snapshot_id = snapshot.id and child.owner_id is null
    and snapshot.owner_id = current_owner;
  update public.e2e_version_conflicts conflict set owner_id = snapshot.owner_id
  from public.e2e_snapshots snapshot
  where conflict.first_snapshot_id = snapshot.id and conflict.owner_id is null
    and snapshot.owner_id = current_owner;
end;
$$;

revoke all on function public.e2e_claim_legacy_snapshots() from public, anon;
grant execute on function public.e2e_claim_legacy_snapshots() to authenticated;

-- Sustituye únicamente la función, no la migración previa. Todas las búsquedas
-- y mutaciones quedan explícitamente dentro del propietario actual.
create or replace function public.e2e_resolve_version_conflict(
  p_conflict_id uuid,
  p_resolved_snapshot_id uuid,
  p_resolved_by text
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_owner uuid := auth.uid();
  conflict_row public.e2e_version_conflicts%rowtype;
  chosen_generation timestamptz;
  latest_active_generation timestamptz;
  losing_snapshot_id uuid;
begin
  if current_owner is null then
    raise exception 'Se requiere una sesión autenticada.';
  end if;

  select * into conflict_row
  from public.e2e_version_conflicts
  where id = p_conflict_id
    and owner_id = current_owner
    and resolved_at is null
  for update;

  if not found then
    raise exception 'El conflicto no existe, pertenece a otro usuario o ya fue resuelto.';
  end if;
  if p_resolved_snapshot_id not in (
    conflict_row.first_snapshot_id,
    conflict_row.candidate_snapshot_id
  ) then
    raise exception 'La versión seleccionada no pertenece al conflicto.';
  end if;

  losing_snapshot_id := case
    when p_resolved_snapshot_id = conflict_row.first_snapshot_id
      then conflict_row.candidate_snapshot_id
    else conflict_row.first_snapshot_id
  end;

  select generation_at into chosen_generation
  from public.e2e_snapshots
  where id = p_resolved_snapshot_id and owner_id = current_owner;

  select max(generation_at) into latest_active_generation
  from public.e2e_snapshots
  where status = 'active' and owner_id = current_owner;

  if latest_active_generation is null or latest_active_generation <= chosen_generation then
    update public.e2e_snapshots set status = 'older'
    where status = 'active' and id <> p_resolved_snapshot_id
      and owner_id = current_owner;
    update public.e2e_snapshots set status = 'active'
    where id = p_resolved_snapshot_id and owner_id = current_owner;
  else
    update public.e2e_snapshots set status = 'older'
    where id = p_resolved_snapshot_id and owner_id = current_owner;
  end if;

  update public.e2e_snapshots set status = 'older'
  where id = losing_snapshot_id and owner_id = current_owner;

  update public.e2e_version_conflicts
  set resolved_snapshot_id = p_resolved_snapshot_id,
      resolved_by = lower(trim(p_resolved_by)),
      resolved_at = now()
  where id = p_conflict_id and owner_id = current_owner;
end;
$$;

revoke all on function public.e2e_resolve_version_conflict(uuid, uuid, text)
  from public, anon;
grant execute on function public.e2e_resolve_version_conflict(uuid, uuid, text)
  to authenticated;

commit;
