-- Bitácora de cambios de status de content_pieces. Solo visible en Supabase, no en la app.
-- Cada vez que una pieza cambia de status se agrega una fila (de qué status a cuál, quién y cuándo).
-- Sirve para: antigüedad en "revision", notificaciones ("X fue aprobada") y tiempos por etapa.
--
-- Cambios en tablas existentes: SOLO un trigger AFTER UPDATE OF status sobre
-- public.content_pieces (autorizado por Enrique). No altera columnas, políticas ni datos
-- de content_pieces ni de clients. No hay backfill: el historial empieza al aplicar esto.

create table if not exists public.content_piece_status_log (
  id uuid primary key default gen_random_uuid(),
  piece_id uuid not null references public.content_pieces(id) on delete cascade,
  -- Copia del cliente de la pieza al momento del cambio, para consultar por cliente sin join.
  client_id uuid references public.clients(id) on delete cascade,
  from_status text,
  to_status text not null,
  -- null cuando el cambio no viene de un usuario con sesión (cron, SQL directo, service role).
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists content_piece_status_log_piece_idx
  on public.content_piece_status_log (piece_id, changed_at desc);
create index if not exists content_piece_status_log_status_idx
  on public.content_piece_status_log (to_status, changed_at desc);
create index if not exists content_piece_status_log_client_idx
  on public.content_piece_status_log (client_id, changed_at desc);

-- Sin acceso desde la app: RLS activado y SIN ninguna política, más revoke de todos los
-- privilegios para anon y authenticated. Solo se consulta desde el dashboard de Supabase
-- (Table Editor / SQL Editor), que entra como postgres. El trigger escribe porque su
-- función es security definer.
alter table public.content_piece_status_log enable row level security;

revoke all on public.content_piece_status_log from anon, authenticated;

-- security definer: el trigger escribe aunque el usuario no tenga permiso de insert en la bitácora.
create or replace function public.log_content_piece_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.content_piece_status_log (piece_id, client_id, from_status, to_status, changed_by)
  values (new.id, new.client_id, old.status, new.status, auth.uid());
  return new;
end;
$$;

revoke all on function public.log_content_piece_status_change() from public, anon, authenticated;

drop trigger if exists trg_log_content_piece_status on public.content_pieces;
create trigger trg_log_content_piece_status
  after update of status on public.content_pieces
  for each row
  when (old.status is distinct from new.status)
  execute function public.log_content_piece_status_change();

-- Verificación (solo lectura), después de aplicar:
-- select tgname from pg_trigger where tgrelid = 'public.content_pieces'::regclass and not tgisinternal;
--   (debe listar trg_log_content_piece_status)
-- Después de mover una pieza de status desde Entregas:
-- select * from public.content_piece_status_log order by changed_at desc limit 5;
