-- Página de Clientes: agrega precio y amplía "package" para soportar el valor
-- "Solamente Pauta" (no numérico). Se decidió migrar package de smallint a text
-- en vez de agregar una columna booleana aparte, para no tener dos campos que
-- puedan quedar incoherentes entre sí.

-- 1. Precio (puede quedar vacío hasta que se capture).
alter table public.clients
  add column if not exists price numeric;

-- 2. package: smallint (1|2|3) -> text ('1'|'2'|'3'|'solamente_pauta').
alter table public.clients
  drop constraint if exists clients_package_check;

alter table public.clients
  alter column package type text using (package::text);

alter table public.clients
  add constraint clients_package_check
  check (package is null or package in ('1', '2', '3', 'solamente_pauta'));
