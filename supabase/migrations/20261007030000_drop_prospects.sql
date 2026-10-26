-- Se elimina el módulo de prospectos (ya no se desarrolla). Borra las tablas y sus datos.
-- prospect_activity depende de prospects, por eso va primero.
drop table if exists public.prospect_activity;
drop table if exists public.prospects;
