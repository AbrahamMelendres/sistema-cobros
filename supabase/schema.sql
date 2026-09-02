-- Esquema del proyecto Supabase "sistema-cobros"
-- Ya aplicado en el proyecto: https://cxhejiygwmxvneicermw.supabase.co
-- Este archivo queda como referencia / para reproducirlo en otro entorno.

create table if not exists public.registros (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  numero int,
  nombre_completo text,
  ci text,
  celular text,
  monto numeric not null default 10 check (monto in (10, 20, 30,40, 50, 60, 70, 80, 90, 100)),
  metodo_pago text check (metodo_pago in ('Efectivo', 'QR') or metodo_pago is null),
  estado text not null default 'Pendiente' check (estado in ('Pendiente', 'Cancelado')),
  observaciones text,
  tipo_equipo text check (tipo_equipo in ('Pc', 'Laptop') or tipo_equipo is null),
  encargada text,
  created_at timestamptz not null default now()
);

create index if not exists registros_fecha_idx on public.registros (fecha);

alter table public.registros enable row level security;

create policy "Usuarios autenticados pueden leer registros"
  on public.registros for select to authenticated using (true);
create policy "Usuarios autenticados pueden insertar registros"
  on public.registros for insert to authenticated with check (true);
create policy "Usuarios autenticados pueden actualizar registros"
  on public.registros for update to authenticated using (true) with check (true);
create policy "Usuarios autenticados pueden borrar registros"
  on public.registros for delete to authenticated using (true);

alter publication supabase_realtime add table public.registros;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre_completo text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Usuarios autenticados pueden leer perfiles"
  on public.profiles for select to authenticated using (true);

-- Para crear un nuevo usuario (por ejemplo otra recepcionista):
-- 1. Supabase Dashboard -> Authentication -> Users -> Add user
-- 2. Luego insertar su perfil:
-- insert into public.profiles (id, nombre_completo) values ('<uid-del-usuario>', 'Nombre Completo');
