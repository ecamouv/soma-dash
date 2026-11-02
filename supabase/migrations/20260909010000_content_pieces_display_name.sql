-- Nombre visible opcional para una pieza de contenido. Si es null, la UI sigue
-- mostrando el código (ej. "9.v.4"); si tiene valor, reemplaza al código en
-- todos los lugares donde se muestra el nombre de la pieza.
alter table public.content_pieces
  add column if not exists display_name text;
