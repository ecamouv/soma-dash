-- Nuevo paquete "Paquete 6 Videos" (6 videos al mes, sin fotos). Ver lib/packages.ts.
alter table public.clients
  drop constraint if exists clients_package_check;

alter table public.clients
  add constraint clients_package_check
  check (package is null or package in ('1', '2', '3', '6_videos', 'solamente_pauta'));

update public.clients set package = '6_videos' where name = 'Reta Saca';
