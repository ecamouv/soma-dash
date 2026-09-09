-- Guarda el paquete de contenido asignado a cada cliente al darlo de alta desde
-- la página Soma (home). Los paquetes son un catálogo fijo en código
-- (lib/packages.ts), no una tabla — aquí solo se guarda el número (1, 2 o 3).

alter table public.clients
  add column if not exists package smallint;

alter table public.clients
  drop constraint if exists clients_package_check;

alter table public.clients
  add constraint clients_package_check
  check (package is null or package in (1, 2, 3));
