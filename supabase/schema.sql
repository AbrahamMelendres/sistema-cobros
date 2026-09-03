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
  cantidad_equipos int not null default 1 check (cantidad_equipos > 0),
  equipos jsonb not null default '[]'::jsonb,
  monto numeric not null default 10 check (monto > 0),
  metodo_pago text check (metodo_pago in ('Efectivo', 'QR') or metodo_pago is null),
  estado text not null default 'Pendiente' check (estado in ('Pendiente', 'Cancelado')),
  servicios text[] not null default '{}',
  estado_pago text not null default 'Pendiente' check (estado_pago in ('Pendiente', 'Pagado')),
  estado_entrega text not null default 'Pendiente' check (estado_entrega in ('Pendiente', 'Entregado', 'No recogido')),
  fecha_entrega date,
  observaciones text,
  tipo_equipo text check (tipo_equipo in ('Pc', 'Laptop') or tipo_equipo is null),
  encargada text,
  created_at timestamptz not null default now()
);

create index if not exists registros_fecha_idx on public.registros (fecha);

alter table public.registros enable row level security;

drop policy if exists "Usuarios autenticados pueden leer registros" on public.registros;
drop policy if exists "Usuarios autenticados pueden insertar registros" on public.registros;
drop policy if exists "Usuarios autenticados pueden actualizar registros" on public.registros;
drop policy if exists "Usuarios autenticados pueden borrar registros" on public.registros;

create policy "Usuarios autenticados pueden leer registros"
  on public.registros for select to authenticated using (true);
create policy "Usuarios autenticados pueden insertar registros"
  on public.registros for insert to authenticated with check (true);
create policy "Usuarios autenticados pueden actualizar registros"
  on public.registros for update to authenticated using (true) with check (true);
create policy "Usuarios autenticados pueden borrar registros"
  on public.registros for delete to authenticated using (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'registros'
  ) then
    alter publication supabase_realtime add table public.registros;
  end if;
end
$$;

-- Migración para una instalación que ya tiene creada la tabla registros.
alter table public.registros add column if not exists servicio text;
alter table public.registros add column if not exists servicios text[] not null default '{}';
alter table public.registros add column if not exists cantidad_equipos int not null default 1;
alter table public.registros add column if not exists equipos jsonb not null default '[]'::jsonb;
update public.registros set cantidad_equipos = 1 where cantidad_equipos is null or cantidad_equipos < 1;
alter table public.registros drop constraint if exists registros_cantidad_equipos_check;
alter table public.registros add constraint registros_cantidad_equipos_check check (cantidad_equipos > 0);
alter table public.registros drop constraint if exists registros_monto_check;
alter table public.registros add constraint registros_monto_check check (monto > 0);
update public.registros
set servicios = case when servicio is null or servicio = '' then '{}' else array[servicio] end
where servicios = '{}';
alter table public.registros drop constraint if exists registros_servicios_check;
alter table public.registros add constraint registros_servicios_check
  check (servicios <@ array['Mantenimiento', 'Formateo', 'Optimizacion', 'Otros']::text[]);
alter table public.registros add column if not exists estado_pago text;
alter table public.registros add column if not exists estado_entrega text;
alter table public.registros add column if not exists fecha_entrega date;
update public.registros
set estado_pago = case when estado = 'Cancelado' then 'Pagado' else 'Pendiente' end
where estado_pago is null;
alter table public.registros alter column estado_pago set default 'Pendiente';
alter table public.registros alter column estado_pago set not null;
alter table public.registros drop constraint if exists registros_servicio_check;
alter table public.registros add constraint registros_servicio_check
  check (servicio in ('Mantenimiento', 'Formateo', 'Optimizacion', 'Otros') or servicio is null);
alter table public.registros drop constraint if exists registros_estado_pago_check;
alter table public.registros add constraint registros_estado_pago_check
  check (estado_pago in ('Pendiente', 'Pagado'));
alter table public.registros alter column estado_entrega set default 'Pendiente';
update public.registros
set estado_entrega = 'Pendiente'
where estado_entrega is null;
alter table public.registros alter column estado_entrega set not null;
alter table public.registros drop constraint if exists registros_estado_entrega_check;
alter table public.registros add constraint registros_estado_entrega_check
  check (estado_entrega in ('Pendiente', 'Entregado', 'No recogido'));

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre_completo text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Usuarios autenticados pueden leer perfiles" on public.profiles;

create policy "Usuarios autenticados pueden leer perfiles"
  on public.profiles for select to authenticated using (true);

-- Para crear un nuevo usuario (por ejemplo otra recepcionista):
-- 1. Supabase Dashboard -> Authentication -> Users -> Add user
-- 2. Luego insertar su perfil:
-- insert into public.profiles (id, nombre_completo) values ('<uid-del-usuario>', 'Nombre Completo');
