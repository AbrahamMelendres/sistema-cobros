"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import GeneradorInforme, {
  type DetalleActividadInforme,
  type FilaInforme,
  type PendienteInforme,
} from "@/components/GeneradorInforme";

type Periodo = "dia" | "semana" | "mes" | "anio";

interface OpcionCatalogo {
  id: string;
  nombre: string;
}

interface Movimiento {
  id: string;
  fecha: string;
  actividad_id: string | null;
  responsable_id: string | null;
  tipo: "Ingreso" | "Egreso";
  concepto: string;
  monto: number;
  metodo_pago: string | null;
  actividad: { nombre: string }[] | null;
  responsable: { nombre: string }[] | null;
}

interface Pendiente {
  descripcion: string;
  monto: number;
  actividad: { nombre: string }[] | null;
  responsable: { nombre: string }[] | null;
  estado: string;
  fecha_registro: string;
}

interface ResumenActividad {
  actividad_id?: string | null;
  actividad?: string | null;
  actividad_nombre?: string | null;
  total_ingresos?: number | null;
  total_egresos?: number | null;
  total_movimientos?: number | null;
  movimientos?: number | null;
}

interface ResumenResponsable {
  responsable_id?: string | null;
  responsable?: string | null;
  responsable_nombre?: string | null;
  total_ingresos?: number | null;
  total_egresos?: number | null;
  total_movimientos?: number | null;
}

function fechaLocalISO(fecha: Date) {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function rangoDelPeriodo(periodo: Periodo, fechaReferencia: string, anioReferencia: number) {
  if (periodo === "anio") {
    return { inicio: `${anioReferencia}-01-01`, fin: `${anioReferencia}-12-31` };
  }

  const fecha = new Date(`${fechaReferencia}T00:00:00`);
  let inicio = new Date(fecha);
  let fin = new Date(fecha);

  if (periodo === "semana") {
    const dia = fecha.getDay();
    const diferenciaLunes = dia === 0 ? -6 : 1 - dia;
    inicio.setDate(fecha.getDate() + diferenciaLunes);
    fin = new Date(inicio);
    fin.setDate(inicio.getDate() + 6);
  } else if (periodo === "mes") {
    inicio = new Date(fecha.getFullYear(), fecha.getMonth(), 1);
    fin = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0);
  }

  return { inicio: fechaLocalISO(inicio), fin: fechaLocalISO(fin) };
}

function formatoMoneda(valor: number) {
  return `${valor.toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} Bs`;
}

function formatFecha(iso: string) {
  const fecha = new Date(`${iso}T00:00:00`);
  const label = fecha.toLocaleDateString("es-BO", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function nombreRelacionado(relacion: { nombre: string }[] | null | undefined, predeterminado: string) {
  return relacion?.[0]?.nombre ?? predeterminado;
}

export default function InformeCajaDashboard() {
  const supabase = useMemo(() => createClient(), []);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [actividades, setActividades] = useState<OpcionCatalogo[]>([]);
  const [responsables, setResponsables] = useState<OpcionCatalogo[]>([]);
  const [resumenActividades, setResumenActividades] = useState<ResumenActividad[]>([]);
  const [resumenResponsables, setResumenResponsables] = useState<ResumenResponsable[]>([]);
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [fondosAnteriores, setFondosAnteriores] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>("dia");
  const [fechaReferencia, setFechaReferencia] = useState(() => fechaLocalISO(new Date()));
  const [anioReferencia, setAnioReferencia] = useState(() => String(new Date().getFullYear()));
  const [actividadId, setActividadId] = useState("");
  const [responsableId, setResponsableId] = useState("");

  const anioNumerico = Number(anioReferencia);
  const anioSeleccionado = /^\d{4}$/.test(anioReferencia) && anioNumerico >= 1000 && anioNumerico <= 9999
    ? anioNumerico
    : new Date().getFullYear();
  const rango = rangoDelPeriodo(periodo, fechaReferencia, anioSeleccionado);

  async function cargarDatos() {
    setLoading(true);
    setError(null);

    let movimientosQuery = supabase
      .from("movimientos")
      .select("id, fecha, actividad_id, responsable_id, tipo, concepto, monto, metodo_pago, actividad:actividades(nombre), responsable:responsables(nombre)")
      .gte("fecha", rango.inicio)
      .lte("fecha", rango.fin);
    let pendientesQuery = supabase
      .from("pendientes")
      .select("descripcion, monto, estado, fecha_registro, actividad:actividades(nombre), responsable:responsables(nombre)")
      .gte("fecha_registro", rango.inicio)
      .lte("fecha_registro", rango.fin);
    const cargarMovimientosAnteriores = async () => {
      const anteriores: Pick<Movimiento, "tipo" | "monto">[] = [];
      const tamanoPagina = 1000;

      for (let desde = 0; ; desde += tamanoPagina) {
        let query = supabase
          .from("movimientos")
          .select("tipo, monto")
          .lt("fecha", rango.inicio);
        if (actividadId) query = query.eq("actividad_id", actividadId);
        if (responsableId) query = query.eq("responsable_id", responsableId);

        const { data, error } = await query.order("id").range(desde, desde + tamanoPagina - 1);
        if (error) return { data: null, error };

        const pagina = (data ?? []) as Pick<Movimiento, "tipo" | "monto">[];
        anteriores.push(...pagina);
        if (pagina.length < tamanoPagina) return { data: anteriores, error: null };
      }
    };

    if (actividadId) {
      movimientosQuery = movimientosQuery.eq("actividad_id", actividadId);
      pendientesQuery = pendientesQuery.eq("actividad_id", actividadId);
    }
    if (responsableId) {
      movimientosQuery = movimientosQuery.eq("responsable_id", responsableId);
      pendientesQuery = pendientesQuery.eq("responsable_id", responsableId);
    }

    const [movimientosResult, pendientesResult, movimientosAnterioresResult, catalogosResult] = await Promise.all([
      movimientosQuery,
      pendientesQuery,
      cargarMovimientosAnteriores(),
      Promise.all([
        supabase.from("actividades").select("id, nombre").eq("activa", true).order("nombre"),
        supabase.from("responsables").select("id, nombre").eq("activo", true).order("nombre"),
      ]),
    ]);

    const catalogoError = catalogosResult[0].error ?? catalogosResult[1].error;
    const primerError = movimientosResult.error ?? pendientesResult.error ?? movimientosAnterioresResult.error ?? catalogoError;
    if (primerError) {
      setError(`No se pudo cargar el informe de caja: ${primerError.message}`);
      setLoading(false);
      return;
    }

    const movimientosFiltrados = (movimientosResult.data ?? []) as Movimiento[];
    const fondosAnterioresCalculados = (movimientosAnterioresResult.data ?? []).reduce(
      (total, movimiento) => total + (movimiento.tipo === "Ingreso" ? 1 : -1) * (Number(movimiento.monto) || 0),
      0,
    );
    const actividadesAgrupadas = new Map<string, ResumenActividad>();
    const responsablesAgrupados = new Map<string, ResumenResponsable>();
    for (const movimiento of movimientosFiltrados) {
      const monto = Number(movimiento.monto) || 0;
      const actividadKey = movimiento.actividad_id ?? "sin-actividad";
      const actividad = actividadesAgrupadas.get(actividadKey) ?? {
        actividad_id: movimiento.actividad_id,
        actividad_nombre: nombreRelacionado(movimiento.actividad, "Sin actividad"),
        total_ingresos: 0,
        total_egresos: 0,
        total_movimientos: 0,
      };
      actividad.total_movimientos = (actividad.total_movimientos ?? 0) + 1;
      if (movimiento.tipo === "Ingreso") actividad.total_ingresos = (actividad.total_ingresos ?? 0) + monto;
      else actividad.total_egresos = (actividad.total_egresos ?? 0) + monto;
      actividadesAgrupadas.set(actividadKey, actividad);

      const responsableKey = movimiento.responsable_id ?? "sin-responsable";
      const responsable = responsablesAgrupados.get(responsableKey) ?? {
        responsable_id: movimiento.responsable_id,
        responsable_nombre: nombreRelacionado(movimiento.responsable, "Sin responsable"),
        total_ingresos: 0,
        total_egresos: 0,
        total_movimientos: 0,
      };
      responsable.total_movimientos = (responsable.total_movimientos ?? 0) + 1;
      if (movimiento.tipo === "Ingreso") responsable.total_ingresos = (responsable.total_ingresos ?? 0) + monto;
      else responsable.total_egresos = (responsable.total_egresos ?? 0) + monto;
      responsablesAgrupados.set(responsableKey, responsable);
    }

    setMovimientos(movimientosFiltrados);
    setFondosAnteriores(fondosAnterioresCalculados);
    setResumenActividades(Array.from(actividadesAgrupadas.values()));
    setResumenResponsables(Array.from(responsablesAgrupados.values()));
    setPendientes((pendientesResult.data ?? []) as Pendiente[]);
    setActividades(catalogosResult[0].data ?? []);
    setResponsables(catalogosResult[1].data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, periodo, fechaReferencia, anioReferencia, actividadId, responsableId]);

  useEffect(() => {
    const cargarPorCambio = () => cargarDatos();
    const channel = supabase
      .channel("informe-caja")
      .on("postgres_changes", { event: "*", schema: "public", table: "movimientos" }, cargarPorCambio)
      .on("postgres_changes", { event: "*", schema: "public", table: "custodia_movimientos" }, cargarPorCambio)
      .on("postgres_changes", { event: "*", schema: "public", table: "pendientes" }, cargarPorCambio)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, periodo, fechaReferencia, anioReferencia, actividadId, responsableId]);

  const totales = useMemo(() => {
    const ingresos = movimientos
      .filter((movimiento) => movimiento.tipo === "Ingreso")
      .reduce((total, movimiento) => total + (Number(movimiento.monto) || 0), 0);
    const egresos = movimientos
      .filter((movimiento) => movimiento.tipo === "Egreso")
      .reduce((total, movimiento) => total + (Number(movimiento.monto) || 0), 0);
    return {
      ingresos,
      egresos,
      neto: ingresos - egresos,
      movimientos: movimientos.length,
    };
  }, [movimientos]);

  const responsablesAgrupados = useMemo(() => {
    if (resumenResponsables.length > 0) return resumenResponsables;
    const mapa = new Map<string, ResumenResponsable>();
    for (const movimiento of movimientos) {
      const key = movimiento.responsable_id ?? "sin-responsable";
      const actual = mapa.get(key) ?? {
        responsable_id: movimiento.responsable_id,
        responsable: responsables.find((item) => item.id === movimiento.responsable_id)?.nombre ?? "Sin responsable",
        total_ingresos: 0,
        total_egresos: 0,
        total_movimientos: 0,
      };
      actual.total_movimientos = (actual.total_movimientos ?? 0) + 1;
      if (movimiento.tipo === "Ingreso") actual.total_ingresos = (actual.total_ingresos ?? 0) + Number(movimiento.monto);
      else actual.total_egresos = (actual.total_egresos ?? 0) + Number(movimiento.monto);
      mapa.set(key, actual);
    }
    return Array.from(mapa.values());
  }, [movimientos, responsables, resumenResponsables]);

  const tituloPeriodo = periodo === "dia"
    ? `Día ${formatFecha(rango.inicio)}`
    : periodo === "semana"
    ? `Semana ${formatFecha(rango.inicio)} - ${formatFecha(rango.fin)}`
    : periodo === "mes"
    ? `Mes ${formatFecha(rango.inicio)} - ${formatFecha(rango.fin)}`
    : `Año ${anioSeleccionado}`;

  const tarjetas = [
    { label: "Total de ingresos", valor: totales.ingresos, tono: "ok" },
    { label: "Total de egresos", valor: totales.egresos, tono: "pending" },
    { label: "Resultado neto del período", valor: totales.neto, tono: totales.neto >= 0 ? "ok" : "pending" },
    { label: "Total de movimientos", valor: totales.movimientos, esMonto: false },
  ];

  const filasInforme: FilaInforme[] = movimientos.map((movimiento) => ({
    fecha: movimiento.fecha,
    actividad: nombreRelacionado(movimiento.actividad, "Sin actividad"),
    tipo: movimiento.tipo,
    concepto: movimiento.concepto,
    monto: Number(movimiento.monto) || 0,
    metodo: movimiento.metodo_pago ?? "Sin especificar",
    responsable: nombreRelacionado(movimiento.responsable, "Sin responsable"),
  }));
  const ingresosInforme = filasInforme.filter((fila) => fila.tipo === "Ingreso");
  const egresosInforme = filasInforme.filter((fila) => fila.tipo === "Egreso");
  const pendientesInforme: PendienteInforme[] = pendientes.map((pendiente) => ({
    descripcion: pendiente.descripcion,
    monto: Number(pendiente.monto) || 0,
    actividad: nombreRelacionado(pendiente.actividad, "Sin actividad"),
    responsable: nombreRelacionado(pendiente.responsable, "Sin responsable"),
    estado: pendiente.estado,
    fecha: pendiente.fecha_registro,
  }));
  const detalleActividadInforme: DetalleActividadInforme[] = resumenActividades.map((detalle) => ({
    actividad: detalle.actividad_nombre ?? detalle.actividad ?? "Sin actividad",
    ingresos: Number(detalle.total_ingresos) || 0,
    egresos: Number(detalle.total_egresos) || 0,
  }));
  const nombreActividadSeleccionada = actividades.find((actividad) => actividad.id === actividadId)?.nombre;
  const nombreResponsableSeleccionado = responsables.find((responsable) => responsable.id === responsableId)?.nombre;
  const propsInforme = {
    periodo: tituloPeriodo,
    ingresos: ingresosInforme,
    egresos: egresosInforme,
    pendientes: pendientesInforme,
    detalleActividad: detalleActividadInforme,
    fondosAnteriores,
  };

  return (
    <div className="report-print-area">
      <div className="mb-6 rounded-xl border border-[var(--color-line)] bg-white px-5 py-4 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-display text-base font-semibold text-[var(--color-ink)]">Informe de caja</p>
            <p className="text-xs text-[var(--color-ink-soft)]">Movimientos del período seleccionado</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-ink-soft)]">Período</p>
            <p className="font-display text-lg font-semibold text-[var(--color-ink)]">{tituloPeriodo}</p>
          </div>
        </div>
      </div>

      <div className="no-print mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--color-line)] bg-white p-3">
        <div>
          <span className="mb-1.5 block text-xs font-medium text-[var(--color-ink-soft)]">Período del informe</span>
          <div className="flex rounded-lg border border-[var(--color-line)] p-0.5">
            {(["dia", "semana", "mes", "anio"] as const).map((opcion) => (
              <button
                key={opcion}
                type="button"
                onClick={() => setPeriodo(opcion)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${periodo === opcion ? "bg-[var(--color-navy-800)] text-white" : "text-[var(--color-ink-soft)] hover:bg-[var(--color-navy-50)]"}`}
              >
                {opcion === "dia" ? "Día" : opcion === "semana" ? "Semana" : opcion === "mes" ? "Mes" : "Año"}
              </button>
            ))}
          </div>
        </div>
        <label className="text-xs font-medium text-[var(--color-ink-soft)]">
          {periodo === "anio" ? "Año de referencia" : "Fecha de referencia"}
          {periodo === "anio" ? (
            <input
              type="number"
              min="1000"
              max="9999"
              step="1"
              value={anioReferencia}
              onChange={(event) => setAnioReferencia(event.target.value)}
              onBlur={() => {
                if (!/^\d{4}$/.test(anioReferencia) || anioNumerico < 1000 || anioNumerico > 9999) {
                  setAnioReferencia(String(new Date().getFullYear()));
                }
              }}
              className="mt-1 block w-32 rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-sm font-normal text-[var(--color-ink)]"
            />
          ) : (
            <input type="date" value={fechaReferencia} onChange={(event) => setFechaReferencia(event.target.value)} className="mt-1 block rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-sm font-normal text-[var(--color-ink)]" />
          )}
        </label>
        <label className="text-xs font-medium text-[var(--color-ink-soft)]">
          Actividad
          <select value={actividadId} onChange={(event) => setActividadId(event.target.value)} className="mt-1 block rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-sm font-normal text-[var(--color-ink)]">
            <option value="">Todas</option>
            {actividades.map((actividad) => <option key={actividad.id} value={actividad.id}>{actividad.nombre}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-[var(--color-ink-soft)]">
          Responsable
          <select value={responsableId} onChange={(event) => setResponsableId(event.target.value)} className="mt-1 block rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-sm font-normal text-[var(--color-ink)]">
            <option value="">Todos</option>
            {responsables.map((responsable) => <option key={responsable.id} value={responsable.id}>{responsable.nombre}</option>)}
          </select>
        </label>
      </div>

      {loading && <p className="mb-6 rounded-lg bg-[var(--color-navy-50)] px-3 py-2 text-sm text-[var(--color-ink-soft)]">Cargando informe…</p>}
      {error && <p className="mb-6 rounded-lg bg-[var(--color-pending-bg)] px-3 py-2 text-sm text-[var(--color-pending)]">{error}</p>}

      {!loading && !error && (
        <>
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tarjetas.map((tarjeta) => (
              <div key={tarjeta.label} className="rounded-xl border border-[var(--color-line)] bg-white px-4 py-4">
                <p className="mb-1 text-xs text-[var(--color-ink-soft)]">{tarjeta.label}</p>
                <p className={`font-display text-2xl font-semibold ${tarjeta.tono === "ok" ? "text-[var(--color-ok)]" : tarjeta.tono === "pending" ? "text-[var(--color-pending)]" : "text-[var(--color-ink)]"}`}>
                  {tarjeta.esMonto === false ? tarjeta.valor : formatoMoneda(Number(tarjeta.valor) || 0)}
                </p>
              </div>
            ))}
          </div>

          <section className="no-print mb-8 rounded-xl border border-[var(--color-line)] bg-white p-4">
            <h2 className="mb-3 font-display text-lg font-semibold text-[var(--color-ink)]">Generar informes</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <GeneradorInforme {...propsInforme} tipo="general" titulo="Informe general de caja" botonLabel="Generar informe general" />
              <GeneradorInforme {...propsInforme} tipo="actividad" titulo={`Informe por actividad${nombreActividadSeleccionada ? `: ${nombreActividadSeleccionada}` : ""}`} botonLabel="Generar informe por actividad" />
              <GeneradorInforme {...propsInforme} tipo="ingresos-egresos" titulo="Informe de ingresos y egresos" botonLabel="Generar informe de ingresos y egresos" />
              <GeneradorInforme {...propsInforme} tipo="pendientes" titulo="Informe de pendientes" ingresos={[]} egresos={[]} botonLabel="Generar informe de pendientes" />
              <GeneradorInforme {...propsInforme} tipo="responsable" titulo={`Informe por responsable${nombreResponsableSeleccionado ? `: ${nombreResponsableSeleccionado}` : ""}`} botonLabel="Generar informe por responsable" />
              <GeneradorInforme {...propsInforme} tipo="rendicion" titulo="Rendición de caja" botonLabel="Generar rendición de caja" />
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="overflow-hidden rounded-xl border border-[var(--color-line)] bg-white">
              <div className="border-b border-[var(--color-line)] px-4 py-4"><h2 className="font-display text-lg font-semibold">Desglose por actividad</h2></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-[var(--color-line)] bg-[var(--color-navy-50)]"><th className="px-4 py-2.5 text-left font-medium text-[var(--color-ink-soft)]">Actividad</th><th className="px-4 py-2.5 text-right font-medium text-[var(--color-ink-soft)]">Ingresos</th><th className="px-4 py-2.5 text-right font-medium text-[var(--color-ink-soft)]">Egresos</th></tr></thead>
                  <tbody>
                    {resumenActividades.length === 0 ? <tr><td colSpan={3} className="px-4 py-8 text-center text-[var(--color-ink-soft)]">No hay datos para este período.</td></tr> : resumenActividades.map((item, indice) => <tr key={item.actividad_id ?? item.actividad ?? indice} className="border-b border-[var(--color-line)] last:border-0"><td className="px-4 py-2.5">{item.actividad_nombre ?? item.actividad ?? "Sin actividad"}</td><td className="px-4 py-2.5 text-right text-[var(--color-ok)]">{formatoMoneda(Number(item.total_ingresos) || 0)}</td><td className="px-4 py-2.5 text-right text-[var(--color-pending)]">{formatoMoneda(Number(item.total_egresos) || 0)}</td></tr>)}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-[var(--color-line)] bg-white">
              <div className="border-b border-[var(--color-line)] px-4 py-4"><h2 className="font-display text-lg font-semibold">Desglose por responsable</h2></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-[var(--color-line)] bg-[var(--color-navy-50)]"><th className="px-4 py-2.5 text-left font-medium text-[var(--color-ink-soft)]">Responsable</th><th className="px-4 py-2.5 text-right font-medium text-[var(--color-ink-soft)]">Ingresos</th><th className="px-4 py-2.5 text-right font-medium text-[var(--color-ink-soft)]">Egresos</th></tr></thead>
                  <tbody>
                    {responsablesAgrupados.length === 0 ? <tr><td colSpan={3} className="px-4 py-8 text-center text-[var(--color-ink-soft)]">No hay datos para este período.</td></tr> : responsablesAgrupados.map((item, indice) => <tr key={item.responsable_id ?? item.responsable ?? indice} className="border-b border-[var(--color-line)] last:border-0"><td className="px-4 py-2.5">{item.responsable_nombre ?? item.responsable ?? "Sin responsable"}</td><td className="px-4 py-2.5 text-right text-[var(--color-ok)]">{formatoMoneda(Number(item.total_ingresos) || 0)}</td><td className="px-4 py-2.5 text-right text-[var(--color-pending)]">{formatoMoneda(Number(item.total_egresos) || 0)}</td></tr>)}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
