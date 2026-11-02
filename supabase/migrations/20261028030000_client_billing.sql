-- Cobro mensual por cliente (reemplaza las fechas de pago sueltas de client_payments).
--   package_prices        : precio mensual de cada paquete (editable desde la página Paquetes).
--   client_billing        : día de pago de cada cliente, precio personalizado opcional y primer mes a cobrar.
--   client_payment_months : un renglón por cliente y mes PAGADO (si no existe el renglón, ese mes está sin pagar).
-- Tablas nuevas e independientes: NO modifican clients ni content_pieces (client_id solo las referencia).
-- client_payments se elimina en la migración 20261029000000_drop_client_payments.
--
-- Acceso: solo admin, dev y operaciones (lectura y escritura), validado en la base de datos.

create or replace function public.can_manage_billing()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'dev', 'operaciones')
  );
$$;

revoke all on function public.can_manage_billing() from public, anon;
grant execute on function public.can_manage_billing() to authenticated;

-- Precio mensual por paquete ('1', '2', '3', '6_videos', 'solamente_pauta'). Sin renglón = sin precio.
create table if not exists public.package_prices (
  package text primary key,
  price numeric not null check (price >= 0),
  updated_at timestamptz not null default now()
);

-- Configuración de cobro por cliente.
create table if not exists public.client_billing (
  client_id uuid primary key references public.clients(id) on delete cascade,
  pay_day integer not null check (pay_day between 1 and 31),
  custom_price numeric check (custom_price is null or custom_price >= 0),
  -- Primer mes que cuenta como cobrable, 'YYYY-MM'. Los anteriores no generan adeudo.
  start_period text not null check (start_period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  updated_at timestamptz not null default now()
);

-- Meses pagados. amount = lo que se registró como pagado en ese momento.
create table if not exists public.client_payment_months (
  client_id uuid not null references public.clients(id) on delete cascade,
  period text not null check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  amount numeric,
  paid_at timestamptz not null default now(),
  primary key (client_id, period)
);

drop trigger if exists package_prices_set_updated_at on public.package_prices;
create trigger package_prices_set_updated_at
  before update on public.package_prices
  for each row execute function public.set_updated_at();

drop trigger if exists client_billing_set_updated_at on public.client_billing;
create trigger client_billing_set_updated_at
  before update on public.client_billing
  for each row execute function public.set_updated_at();

alter table public.package_prices enable row level security;
alter table public.client_billing enable row level security;
alter table public.client_payment_months enable row level security;

drop policy if exists "Gestionar precios de paquetes" on public.package_prices;
create policy "Gestionar precios de paquetes" on public.package_prices
  for all to authenticated using (public.can_manage_billing()) with check (public.can_manage_billing());

drop policy if exists "Gestionar cobro de clientes" on public.client_billing;
create policy "Gestionar cobro de clientes" on public.client_billing
  for all to authenticated using (public.can_manage_billing()) with check (public.can_manage_billing());

drop policy if exists "Gestionar meses pagados" on public.client_payment_months;
create policy "Gestionar meses pagados" on public.client_payment_months
  for all to authenticated using (public.can_manage_billing()) with check (public.can_manage_billing());

revoke all on public.package_prices, public.client_billing, public.client_payment_months from anon;
grant select, insert, update, delete on public.package_prices, public.client_billing, public.client_payment_months to authenticated;
