-- Permite "pausar" un cliente: congela toda su logística (eventos, piezas de
-- contenido) sin borrar nada. Mientras paused=true, el resto de la app debe
-- filtrar por completo su contenido de Calendario, Entregas y Publicaciones.
-- Reanudar (paused=false) lo hace reaparecer exactamente como estaba.

alter table public.clients
  add column if not exists paused boolean not null default false;
