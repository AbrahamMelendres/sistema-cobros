-- Roles básicos y políticas RLS para el sistema de cobros.
-- Esta migración es deliberadamente no destructiva para los datos, pero reemplaza
-- las políticas permisivas existentes de las tablas indicadas.

create table if not exists public.roles_usuario (
  user_id uuid primary key references auth.users(id) on delete cascade,
  rol text not null check (rol in ('Administrador', 'Encargada', 'Consulta')),
  created_at timestamptz not null default now()
);

alter table public.roles_usuario enable row level security;

create or replace function public.rol_actual()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select rol
  from public.roles_usuario
  where user_id = auth.uid()
$$;

create or replace function public.es_rol(rol_requerido text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.rol_actual() = rol_requerido, false)
$$;

create or replace function public.es_administrador()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.es_rol('Administrador')
$$;

revoke all on function public.rol_actual() from public;
revoke all on function public.es_rol(text) from public;
revoke all on function public.es_administrador() from public;
grant execute on function public.rol_actual() to authenticated;
grant execute on function public.es_rol(text) to authenticated;
grant execute on function public.es_administrador() to authenticated;

-- siga otorgando acceso por la combinación OR de políticas RLS.
do $$
declare
  tabla text;
  politica record;
begin
  foreach tabla in array array[
    'roles_usuario', 'profiles', 'registros', 'actividades',
    'responsables', 'movimientos', 'custodia_movimientos', 'pendientes'
  ] loop
    if to_regclass('public.' || tabla) is not null then
      for politica in
        select policyname
        from pg_policies
        where schemaname = 'public' and tablename = tabla
      loop
        execute format('drop policy if exists %I on public.%I', politica.policyname, tabla);
      end loop;
    end if;
  end loop;
end
$$;

-- roles_usuario: cada usuario puede consultar su propio rol; solo un
-- Administrador puede asignar, modificar o retirar roles.
create policy "roles_usuario_select_propio_o_admin"
  on public.roles_usuario for select to authenticated
  using (user_id = auth.uid() or public.es_administrador());

create policy "roles_usuario_insert_admin"
  on public.roles_usuario for insert to authenticated
  with check (public.es_administrador());

create policy "roles_usuario_update_admin"
  on public.roles_usuario for update to authenticated
  using (public.es_administrador())
  with check (public.es_administrador());

create policy "roles_usuario_delete_admin"
  on public.roles_usuario for delete to authenticated
  using (public.es_administrador());

-- profiles: lectura del propio perfil para cualquier usuario autenticado;
-- administración completa reservada al Administrador.
create policy "profiles_select_propio_o_admin"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.es_administrador());

create policy "profiles_insert_admin"
  on public.profiles for insert to authenticated
  with check (public.es_administrador());

create policy "profiles_update_admin"
  on public.profiles for update to authenticated
  using (public.es_administrador())
  with check (public.es_administrador());

create policy "profiles_delete_admin"
  on public.profiles for delete to authenticated
  using (public.es_administrador());

-- registros: la Encargada opera el registro diario; solo el Administrador
-- puede borrar registros ya creados.
create policy "registros_select_autenticados"
  on public.registros for select to authenticated using (true);

create policy "registros_insert_operativo"
  on public.registros for insert to authenticated
  with check (public.es_rol('Administrador') or public.es_rol('Encargada'));

create policy "registros_update_operativo"
  on public.registros for update to authenticated
  using (public.es_rol('Administrador') or public.es_rol('Encargada'))
  with check (public.es_rol('Administrador') or public.es_rol('Encargada'));

create policy "registros_delete_admin"
  on public.registros for delete to authenticated
  using (public.es_administrador());

-- Catálogos: lectura para todos los usuarios autenticados; cambios solo
-- administrativos para conservar la integridad de los filtros y reportes.
create policy "actividades_select_autenticados"
  on public.actividades for select to authenticated using (true);
create policy "actividades_insert_admin"
  on public.actividades for insert to authenticated with check (public.es_administrador());
create policy "actividades_update_admin"
  on public.actividades for update to authenticated
  using (public.es_administrador()) with check (public.es_administrador());
create policy "actividades_delete_admin"
  on public.actividades for delete to authenticated using (public.es_administrador());

create policy "responsables_select_autenticados"
  on public.responsables for select to authenticated using (true);
create policy "responsables_insert_admin"
  on public.responsables for insert to authenticated with check (public.es_administrador());
create policy "responsables_update_admin"
  on public.responsables for update to authenticated
  using (public.es_administrador()) with check (public.es_administrador());
create policy "responsables_delete_admin"
  on public.responsables for delete to authenticated using (public.es_administrador());

-- movimientos: la Encargada puede registrar movimientos manuales, pero la
-- modificación o eliminación de movimientos financieros queda en Admin.
create policy "movimientos_select_autenticados"
  on public.movimientos for select to authenticated using (true);
create policy "movimientos_insert_operativo"
  on public.movimientos for insert to authenticated
  with check (public.es_rol('Administrador') or public.es_rol('Encargada'));
create policy "movimientos_update_admin"
  on public.movimientos for update to authenticated
  using (public.es_administrador()) with check (public.es_administrador());
create policy "movimientos_delete_admin"
  on public.movimientos for delete to authenticated using (public.es_administrador());

-- custodia_movimientos es el módulo más sensible: solo Admin puede crear,
-- corregir o borrar movimientos de custodia. Los otros roles solo consultan.
create policy "custodia_select_autenticados"
  on public.custodia_movimientos for select to authenticated using (true);
create policy "custodia_insert_admin"
  on public.custodia_movimientos for insert to authenticated with check (public.es_administrador());
create policy "custodia_update_admin"
  on public.custodia_movimientos for update to authenticated
  using (public.es_administrador()) with check (public.es_administrador());
create policy "custodia_delete_admin"
  on public.custodia_movimientos for delete to authenticated using (public.es_administrador());

-- pendientes: la Encargada puede registrar y cambiar el estado de un
-- pendiente, pero solo Admin puede eliminarlo.
create policy "pendientes_select_autenticados"
  on public.pendientes for select to authenticated using (true);
create policy "pendientes_insert_operativo"
  on public.pendientes for insert to authenticated
  with check (public.es_rol('Administrador') or public.es_rol('Encargada'));
create policy "pendientes_update_operativo"
  on public.pendientes for update to authenticated
  using (public.es_rol('Administrador') or public.es_rol('Encargada'))
  with check (public.es_rol('Administrador') or public.es_rol('Encargada'));
create policy "pendientes_delete_admin"
  on public.pendientes for delete to authenticated
  using (public.es_administrador());

-- Las vistas de reportes deben respetar RLS de las tablas base cuando la
-- versión de PostgreSQL/Supabase permite security_invoker.
alter view if exists public.vista_resumen_caja set (security_invoker = true);
alter view if exists public.vista_resumen_por_actividad set (security_invoker = true);
alter view if exists public.vista_dinero_por_responsable set (security_invoker = true);

-- Después de aplicar esta migración, asignar inicialmente el rol del primer
-- administrador desde SQL Editor usando un usuario con privilegios de servicio:
-- insert into public.roles_usuario (user_id, rol)
-- values ('<uid-del-administrador>', 'Administrador');