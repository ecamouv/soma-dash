-- Guarda el ID del evento de Google Calendar creado para cada evento de Soma, para
-- poder actualizarlo (cambio de día/hora/lugar/miembros) o cancelarlo cuando el
-- evento se edita o se borra desde el dashboard. Esto NO es "estado de invitación"
-- (aceptó/rechazó/ignoró) -- es solo el identificador técnico que la API de Google
-- Calendar requiere para PATCH/DELETE. La policy "ALL" que ya existe sobre events
-- cubre esta columna nueva sin cambios adicionales de RLS.

alter table public.events
  add column if not exists google_event_id text;
