-- added_by apuntaba a profiles, pero un usuario puede iniciar sesión sin tener fila
-- en profiles (la app usa un perfil de respaldo). Se liga mejor a auth.users, que
-- siempre existe para quien tiene sesión.
alter table public.inspiration
  drop constraint if exists inspiration_added_by_fkey;

alter table public.inspiration
  add constraint inspiration_added_by_fkey
  foreign key (added_by) references auth.users(id) on delete set null;
