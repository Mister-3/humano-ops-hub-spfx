begin;

create table if not exists public.e2e_snapshots (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  file_hash text not null unique,
  generation_at timestamptz not null,
  imported_at timestamptz not null default now(),
  imported_by text not null,
  status text not null check (status in ('active', 'older', 'conflict')),
  declared_total integer,
  detected_rows integer not null,
  unique_radicaciones integer not null,
  total_pages numeric not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists e2e_snapshots_generation_idx
  on public.e2e_snapshots (generation_at desc);
create index if not exists e2e_snapshots_retention_idx
  on public.e2e_snapshots (imported_at);

create table if not exists public.e2e_rows (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.e2e_snapshots(id) on delete cascade,
  row_number integer not null,
  radicacion text not null,
  flow text not null check (flow in ('emision', 'movimiento', 'cancelacion')),
  original_data jsonb not null,
  normalized_data jsonb not null,
  sla_result jsonb not null,
  manually_excluded boolean not null default false,
  exclusion_reason text,
  created_at timestamptz not null default now(),
  unique (snapshot_id, row_number)
);

create index if not exists e2e_rows_snapshot_idx
  on public.e2e_rows (snapshot_id);
create index if not exists e2e_rows_radication_idx
  on public.e2e_rows (radicacion);

create table if not exists public.e2e_groups (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.e2e_snapshots(id) on delete cascade,
  radicacion text not null,
  group_result jsonb not null,
  created_at timestamptz not null default now(),
  unique (snapshot_id, radicacion)
);

create index if not exists e2e_groups_snapshot_idx
  on public.e2e_groups (snapshot_id);

create table if not exists public.e2e_exclusions (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.e2e_snapshots(id) on delete cascade,
  row_number integer not null,
  excluded_by text not null,
  excluded_at timestamptz not null default now(),
  reason text not null,
  unique (snapshot_id, row_number)
);

create table if not exists public.e2e_report_actions (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.e2e_snapshots(id) on delete cascade,
  radicaciones text[] not null,
  action text not null check (action in ('copy_mark', 'copy_only', 'undo_reported')),
  user_email text not null,
  created_at timestamptz not null default now()
);

create index if not exists e2e_report_actions_snapshot_idx
  on public.e2e_report_actions (snapshot_id, created_at);

create table if not exists public.e2e_version_conflicts (
  id uuid primary key default gen_random_uuid(),
  generation_at timestamptz not null,
  first_snapshot_id uuid not null references public.e2e_snapshots(id) on delete cascade,
  candidate_snapshot_id uuid not null references public.e2e_snapshots(id) on delete cascade,
  resolved_snapshot_id uuid references public.e2e_snapshots(id) on delete set null,
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.e2e_presence_events (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.e2e_snapshots(id) on delete cascade,
  previous_snapshot_id uuid references public.e2e_snapshots(id) on delete set null,
  radicacion text not null,
  status text not null check (status = 'Ya no aparece en el reporte'),
  detected_at timestamptz not null default now(),
  unique (snapshot_id, radicacion)
);

create index if not exists e2e_presence_events_snapshot_idx
  on public.e2e_presence_events (snapshot_id);

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
  conflict_row public.e2e_version_conflicts%rowtype;
  chosen_generation timestamptz;
  latest_active_generation timestamptz;
  losing_snapshot_id uuid;
begin
  select * into conflict_row
  from public.e2e_version_conflicts
  where id = p_conflict_id and resolved_at is null
  for update;

  if not found then
    raise exception 'El conflicto no existe o ya fue resuelto.';
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
  where id = p_resolved_snapshot_id;

  select max(generation_at) into latest_active_generation
  from public.e2e_snapshots
  where status = 'active';

  if latest_active_generation is null or latest_active_generation <= chosen_generation then
    update public.e2e_snapshots
    set status = 'older'
    where status = 'active' and id <> p_resolved_snapshot_id;
    update public.e2e_snapshots
    set status = 'active'
    where id = p_resolved_snapshot_id;
  else
    update public.e2e_snapshots
    set status = 'older'
    where id = p_resolved_snapshot_id;
  end if;

  update public.e2e_snapshots
  set status = 'older'
  where id = losing_snapshot_id;

  update public.e2e_version_conflicts
  set resolved_snapshot_id = p_resolved_snapshot_id,
      resolved_by = lower(trim(p_resolved_by)),
      resolved_at = now()
  where id = p_conflict_id;
end;
$$;

create table if not exists public.e2e_cancellation_aliases (
  id uuid primary key default gen_random_uuid(),
  alias text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.e2e_cancellation_aliases (alias)
values
  ('CANCELACION POLIZA INDIVIDUAL'),
  ('CANCELACION DE POLIZA INDIVIDUAL'),
  ('CANCELACION POLIZA COLECTIVA'),
  ('CANCELACION DE POLIZA COLECTIVA')
on conflict (alias) do nothing;

create table if not exists public.e2e_non_working_periods (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  description text not null,
  type text not null check (type in ('nacional', 'interno')),
  all_day boolean not null default true,
  start_time time,
  end_time time,
  scope text,
  active boolean not null default true,
  observation text,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint e2e_period_time_check check (
    all_day or (start_time is not null and end_time is not null and end_time > start_time)
  )
);

create unique index if not exists e2e_non_working_period_unique_idx
  on public.e2e_non_working_periods (date, description, coalesce(start_time, '00:00'::time));

insert into public.e2e_non_working_periods
  (date, description, type, all_day, active, source)
values
  ('2026-01-01', 'Año Nuevo', 'nacional', true, true, 'https://www.presidencia.gob.do/noticias/ministerio-de-trabajo-informa-dias-feriados-correspondientes-al-ano-2026'),
  ('2026-01-05', 'Día de los Santos Reyes (observado)', 'nacional', true, true, 'https://www.presidencia.gob.do/noticias/ministerio-de-trabajo-informa-dias-feriados-correspondientes-al-ano-2026'),
  ('2026-01-21', 'Nuestra Señora de la Altagracia', 'nacional', true, true, 'https://www.presidencia.gob.do/noticias/ministerio-de-trabajo-informa-dias-feriados-correspondientes-al-ano-2026'),
  ('2026-01-26', 'Natalicio de Juan Pablo Duarte', 'nacional', true, true, 'https://www.presidencia.gob.do/noticias/ministerio-de-trabajo-informa-dias-feriados-correspondientes-al-ano-2026'),
  ('2026-02-27', 'Independencia Nacional', 'nacional', true, true, 'https://www.presidencia.gob.do/noticias/ministerio-de-trabajo-informa-dias-feriados-correspondientes-al-ano-2026'),
  ('2026-04-03', 'Viernes Santo', 'nacional', true, true, 'https://www.presidencia.gob.do/noticias/ministerio-de-trabajo-informa-dias-feriados-correspondientes-al-ano-2026'),
  ('2026-05-04', 'Día del Trabajo (observado)', 'nacional', true, true, 'https://www.presidencia.gob.do/noticias/ministerio-de-trabajo-informa-dias-feriados-correspondientes-al-ano-2026'),
  ('2026-06-04', 'Corpus Christi', 'nacional', true, true, 'https://www.presidencia.gob.do/noticias/ministerio-de-trabajo-informa-dias-feriados-correspondientes-al-ano-2026'),
  ('2026-08-16', 'Día de la Restauración', 'nacional', true, true, 'https://www.presidencia.gob.do/noticias/ministerio-de-trabajo-informa-dias-feriados-correspondientes-al-ano-2026'),
  ('2026-09-24', 'Nuestra Señora de las Mercedes', 'nacional', true, true, 'https://www.presidencia.gob.do/noticias/ministerio-de-trabajo-informa-dias-feriados-correspondientes-al-ano-2026'),
  ('2026-11-09', 'Día de la Constitución (observado)', 'nacional', true, true, 'https://www.presidencia.gob.do/noticias/ministerio-de-trabajo-informa-dias-feriados-correspondientes-al-ano-2026'),
  ('2026-12-25', 'Navidad', 'nacional', true, true, 'https://www.presidencia.gob.do/noticias/ministerio-de-trabajo-informa-dias-feriados-correspondientes-al-ano-2026')
on conflict do nothing;

alter table public.e2e_snapshots enable row level security;
alter table public.e2e_rows enable row level security;
alter table public.e2e_groups enable row level security;
alter table public.e2e_exclusions enable row level security;
alter table public.e2e_report_actions enable row level security;
alter table public.e2e_version_conflicts enable row level security;
alter table public.e2e_presence_events enable row level security;
alter table public.e2e_cancellation_aliases enable row level security;
alter table public.e2e_non_working_periods enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'e2e_snapshots', 'e2e_rows', 'e2e_groups', 'e2e_exclusions', 'e2e_report_actions',
    'e2e_version_conflicts', 'e2e_presence_events', 'e2e_cancellation_aliases',
    'e2e_non_working_periods'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_custom_auth_access', table_name);
    execute format(
      'create policy %I on public.%I for all to anon using (true) with check (true)',
      table_name || '_custom_auth_access', table_name
    );
    execute format('grant select, insert, update, delete on public.%I to anon', table_name);
  end loop;
end $$;

grant execute on function public.e2e_resolve_version_conflict(uuid, uuid, text) to anon;

commit;
