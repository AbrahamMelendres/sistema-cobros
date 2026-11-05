-- Ya aplicada en Supabase (proyecto cxhejiygwmxvneicermw). Solo versionada aquí. Es idempotente.
-- 1. Un solo ingreso por registro (evita duplicados)
create unique index if not exists movimientos_registro_origen_uidx
  on public.movimientos (registro_id)
  where origen = 'registros' and registro_id is not null;

-- 2. Trigger: genera el ingreso al insertar o al pasar a Pagado;
--    sincroniza monto/método si cambian estando Pagado
create or replace function public.fn_registro_a_movimiento()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.estado_pago = 'Pagado'
     and (tg_op = 'INSERT' or old.estado_pago is distinct from 'Pagado') then
    insert into public.movimientos (
      fecha, actividad_id, tipo, concepto, monto, metodo_pago,
      persona_relacionada, origen, registro_id
    )
    values (
      coalesce(new.fecha_entrega, new.fecha, current_date),
      coalesce(new.actividad_id, public.fn_default_actividad_sistemasland()),
      'Ingreso',
      coalesce(nullif(array_to_string(new.servicios, ', '), ''), new.servicio, 'Servicio SistemasLand'),
      new.monto,
      new.metodo_pago,
      new.nombre_completo,
      'registros',
      new.id
    )
    on conflict do nothing;
  elsif tg_op = 'UPDATE'
        and new.estado_pago = 'Pagado'
        and old.estado_pago = 'Pagado'
        and (new.monto is distinct from old.monto
             or new.metodo_pago is distinct from old.metodo_pago) then
    update public.movimientos
       set monto = new.monto,
           metodo_pago = new.metodo_pago
     where registro_id = new.id
       and origen = 'registros';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_registro_a_movimiento on public.registros;
create trigger trg_registro_a_movimiento
  after insert or update on public.registros
  for each row execute function public.fn_registro_a_movimiento();

-- 3. Reparar los registros ya pagados que no tenían ingreso
insert into public.movimientos (
  fecha, actividad_id, tipo, concepto, monto, metodo_pago,
  persona_relacionada, origen, registro_id
)
select
  coalesce(r.fecha_entrega, r.fecha, current_date),
  coalesce(r.actividad_id, public.fn_default_actividad_sistemasland()),
  'Ingreso',
  coalesce(nullif(array_to_string(r.servicios, ', '), ''), r.servicio, 'Servicio SistemasLand'),
  r.monto,
  r.metodo_pago,
  r.nombre_completo,
  'registros',
  r.id
from public.registros r
where r.estado_pago = 'Pagado'
  and not exists (select 1 from public.movimientos m where m.registro_id = r.id)
on conflict do nothing;
