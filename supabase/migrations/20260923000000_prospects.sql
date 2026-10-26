-- Prospectos: seguimiento de clientes potenciales (pipeline comercial) dentro de
-- la página Clientes. prospect_activity guarda la bitácora (llamadas, juntas, notas).

create table if not exists public.prospects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  contact_role text,
  email text,
  phone text,
  market text,
  city text,
  instagram text,
  facebook text,
  tiktok text,
  website text,
  source text,
  stage text not null default 'nuevo'
    check (stage in ('nuevo','contactado','reunion','propuesta','negociacion','ganado','perdido')),
  estimated_value numeric,
  next_step text,
  next_step_date date,
  notes text,
  owner_id uuid references public.profiles(id) on delete set null,
  converted_client_id uuid references public.clients(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prospect_activity (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  note text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists prospect_activity_prospect_idx
  on public.prospect_activity (prospect_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists prospects_set_updated_at on public.prospects;
create trigger prospects_set_updated_at
  before update on public.prospects
  for each row execute function public.set_updated_at();

alter table public.prospects enable row level security;
alter table public.prospect_activity enable row level security;

drop policy if exists "Permitir todo en prospects" on public.prospects;
create policy "Permitir todo en prospects"
  on public.prospects for all to anon, authenticated
  using (true) with check (true);

drop policy if exists "Permitir todo en prospect_activity" on public.prospect_activity;
create policy "Permitir todo en prospect_activity"
  on public.prospect_activity for all to anon, authenticated
  using (true) with check (true);
