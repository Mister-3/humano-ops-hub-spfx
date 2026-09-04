begin;

alter table public.solicitudes_mejora
  add column if not exists adjunto_url text,
  add column if not exists adjunto_nombre text,
  add column if not exists adjunto_tamano bigint;

commit;
