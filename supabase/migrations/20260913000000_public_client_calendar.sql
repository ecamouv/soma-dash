-- Vista pública de calendario por cliente: requiere (1) una tabla de fechas de
-- pago -- se decidió que un cliente puede tener múltiples pagos (abonos), así que
-- es una tabla aparte, no una columna en clients -- y (2) un token opaco por
-- cliente para el link público, separado del id interno (para poder rotarlo sin
-- afectar nada más, y para no exponer el id real usado en el resto del sistema).

create extension if not exists pgcrypto;

-- 1. Fechas de pago (uno o varios por cliente).
create table if not exists public.client_payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  due_date date not null,
  label text,
  amount numeric,
  created_at timestamptz not null default now()
);

alter table public.client_payments enable row level security;

drop policy if exists "Permitir todo en client_payments" on public.client_payments;
create policy "Permitir todo en client_payments"
  on public.client_payments
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- 2. Token público por cliente: 24 caracteres base64url (~144 bits), no adivinable
-- y desacoplado del id interno. Se genera solo con un default a nivel de columna,
-- así que no hace falta tocar el código de creación de clientes.
alter table public.clients
  add column if not exists public_token text;

update public.clients
  set public_token = translate(encode(gen_random_bytes(18), 'base64'), '+/', '-_')
  where public_token is null;

alter table public.clients
  alter column public_token
  set default translate(encode(gen_random_bytes(18), 'base64'), '+/', '-_');

alter table public.clients
  alter column public_token set not null;

alter table public.clients
  drop constraint if exists clients_public_token_key;
alter table public.clients
  add constraint clients_public_token_key unique (public_token);
