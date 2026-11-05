create table if not exists public.bitacora (
  id bigint generated always as identity primary key,
  tabla text not null,
  accion text not null check (accion in ('INSERT', 'UPDATE', 'DELETE')),
  registro_id text,
  usuario_id uuid references auth.users(id) on delete set null,
  usuario_email text,
  campos_cambiados text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists bitacora_created_at_idx
  on public.bitacora (created_at desc);
create index if not exists bitacora_tabla_accion_created_at_idx
  on public.bitacora (tabla, accion, created_at desc);

alter table public.bitacora enable row level security;

drop policy if exists "bitacora_select_admin" on public.bitacora;
create policy "bitacora_select_admin"
  on public.bitacora for select to authenticated
  using (public.es_administrador());

revoke all on public.bitacora from anon, authenticated;
grant select on public.bitacora to authenticated;

create or replace function public.registrar_bitacora_cambio()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  valores_anteriores jsonb;
  valores_nuevos jsonb;
  id_registro text;
  campos text[] := '{}';
begin
  if tg_op <> 'INSERT' then
    valores_anteriores := pg_catalog.to_jsonb(old);
  end if;
  if tg_op <> 'DELETE' then
    valores_nuevos := pg_catalog.to_jsonb(new);
  end if;

  id_registro := coalesce(
    valores_nuevos ->> 'id',
    valores_nuevos ->> 'user_id',
    valores_anteriores ->> 'id',
    valores_anteriores ->> 'user_id'
  );

  if tg_op = 'UPDATE' then
    select coalesce(array_agg(coalesce(n.key, a.key) order by coalesce(n.key, a.key)), '{}')
      into campos
      from pg_catalog.jsonb_each(valores_nuevos) as n(key, value)
      full join pg_catalog.jsonb_each(valores_anteriores) as a(key, value) using (key)
      where n.value is distinct from a.value;
  end if;

  insert into public.bitacora (
    tabla, accion, registro_id, usuario_id, usuario_email, campos_cambiados
  ) values (
    tg_table_name,
    tg_op,
    id_registro,
    auth.uid(),
    nullif(auth.jwt() ->> 'email', ''),
    campos
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

do $$
declare
  nombre_tabla text;
begin
  foreach nombre_tabla in array array[
    'registros',
    'movimientos',
    'pendientes',
    'custodia_movimientos',
    'actividades',
    'responsables',
    'profiles',
    'roles_usuario'
  ] loop
    if to_regclass('public.' || nombre_tabla) is not null then
      execute format(
        'drop trigger if exists bitacora_auditoria on public.%I',
        nombre_tabla
      );
      execute format(
        'create trigger bitacora_auditoria after insert or update or delete on public.%I for each row execute function public.registrar_bitacora_cambio()',
        nombre_tabla
      );
    end if;
  end loop;
end;
$$;
