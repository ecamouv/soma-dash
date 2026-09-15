-- Color asignable por cliente (hex, ej. "#60a5fa"). Nullable: si no se asigna uno,
-- la UI sigue usando su paleta automática por defecto.
alter table public.clients
  add column if not exists color text;
