"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import SelectConCrear from "@/components/SelectConCrear";

type FiltroPendientes = "todos" | "pendientes" | "pagados";
type EstadoPendiente = "Pendiente" | "Pagado";

interface OpcionCatalogo {
  id: string;
  nombre: string;
}

interface Pendiente {
  id: string;
  descripcion: string;
  monto: number;
  actividad_id: string | null;
  responsable_id: string | null;
  estado: EstadoPendiente;
  fecha_registro: string;
  fecha_pago: string | null;
  actividad: { nombre: string }[] | null;
  responsable: { nombre: string }[] | null;
}

function hoyISO() {
  const fecha = new Date();
  const diferenciaZona = fecha.getTimezoneOffset();
  const fechaLocal = new Date(fecha.getTime() - diferenciaZona * 60000);
  return fechaLocal.toISOString().slice(0, 10);
}

function formatoMoneda(valor: number) {
  return `${valor.toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} Bs`;
}

function nombreRelacionado(relacion: { nombre: string }[] | null | undefined) {
  return relacion?.[0]?.nombre ?? "—";
}

export default function PendientesPanel() {
  const supabase = useMemo(() => createClient(), []);
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [actividades, setActividades] = useState<OpcionCatalogo[]>([]);
  const [responsables, setResponsables] = useState<OpcionCatalogo[]>([]);
  const [puedeCrear, setPuedeCrear] = useState(false);
  const [filtro, setFiltro] = useState<FiltroPendientes>("pendientes");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [actividadId, setActividadId] = useState("");
  const [responsableId, setResponsableId] = useState("");
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function cargarDatos() {
    setLoading(true);
    setError(null);

    const [pendientesResult, actividadesResult, responsablesResult, rolResult] = await Promise.all([
      supabase
        .from("pendientes")
        .select("id, descripcion, monto, actividad_id, responsable_id, estado, fecha_registro, fecha_pago, actividad:actividades(nombre), responsable:responsables(nombre)")
        .order("fecha_registro", { ascending: false }),
      supabase
        .from("actividades")
        .select("id, nombre")
        .eq("activa", true)
        .order("nombre"),
      supabase
        .from("responsables")
        .select("id, nombre")
        .eq("activo", true)
        .order("nombre"),
      supabase.rpc("es_administrador"),
    ]);

    const primerError = pendientesResult.error ?? actividadesResult.error ?? responsablesResult.error;
    if (primerError) {
      setError(`No se pudo cargar la información de pendientes: ${primerError.message}`);
      setLoading(false);
      return;
    }

    setPendientes((pendientesResult.data ?? []) as Pendiente[]);
    setActividades(actividadesResult.data ?? []);
    setResponsables(responsablesResult.data ?? []);
    setPuedeCrear(rolResult.data === true);
    setLoading(false);
  }

  useEffect(() => {
    cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  async function crearActividad(nombre: string) {
    const { data, error: insertError } = await supabase
      .from("actividades")
      .insert({ nombre })
      .select("id, nombre")
      .single();
    if (insertError) throw new Error(insertError.message);
    if (!data) return null;
    setActividades((actuales) => [...actuales, data].sort((actividadA, actividadB) => actividadA.nombre.localeCompare(actividadB.nombre)));
    return data;
  }

  async function crearResponsable(nombre: string) {
    const { data, error: insertError } = await supabase
      .from("responsables")
      .insert({ nombre })
      .select("id, nombre")
      .single();
    if (insertError) throw new Error(insertError.message);
    if (!data) return null;
    setResponsables((actuales) => [...actuales, data].sort((responsableA, responsableB) => responsableA.nombre.localeCompare(responsableB.nombre)));
    return data;
  }

  async function crearPendiente(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMensaje(null);

    const montoNumerico = Number(monto);
    if (!descripcion.trim()) {
      setError("Escribe una descripción para el pendiente.");
      return;
    }
    if (!Number.isFinite(montoNumerico) || montoNumerico <= 0) {
      setError("El monto debe ser un número mayor que cero.");
      return;
    }

    setGuardando(true);
    const { error: insertError } = await supabase.from("pendientes").insert({
      descripcion: descripcion.trim(),
      monto: montoNumerico,
      actividad_id: actividadId || null,
      responsable_id: responsableId || null,
      estado: "Pendiente",
      fecha_registro: hoyISO(),
    });
    setGuardando(false);

    if (insertError) {
      setError(`No se pudo crear el pendiente: ${insertError.message}`);
      return;
    }

    setDescripcion("");
    setMonto("");
    setActividadId("");
    setResponsableId("");
    setMensaje("Pendiente creado correctamente.");
    await cargarDatos();
  }

  async function marcarComoPagado(pendiente: Pendiente) {
    if (!confirm(`¿Marcar como pagado el pendiente "${pendiente.descripcion}"?`)) return;

    setError(null);
    setMensaje(null);
    setGuardando(true);
    const { error: updateError } = await supabase
      .from("pendientes")
      .update({ estado: "Pagado", fecha_pago: hoyISO() })
      .eq("id", pendiente.id);
    setGuardando(false);

    if (updateError) {
      setError(`No se pudo marcar como pagado: ${updateError.message}`);
      return;
    }

    setMensaje("Pendiente marcado como pagado.");
    await cargarDatos();
  }

  const pendientesFiltrados = pendientes.filter((pendiente) => {
    if (filtro === "pendientes") return pendiente.estado === "Pendiente";
    if (filtro === "pagados") return pendiente.estado === "Pagado";
    return true;
  });

  const inputClass = "mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-navy-700)]";
  const labelClass = "block text-xs font-medium text-[var(--color-ink-soft)]";

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-[var(--color-ink)]">Pendientes</h1>
        <span className="text-xs text-[var(--color-ink-soft)]">{pendientesFiltrados.length} registro(s)</span>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-[var(--color-pending-bg)] px-3 py-2 text-sm text-[var(--color-pending)]">{error}</p>
      )}
      {mensaje && (
        <p className="mb-4 rounded-lg bg-[var(--color-ok-bg)] px-3 py-2 text-sm text-[var(--color-ok)]">{mensaje}</p>
      )}

      <section className="mb-8 rounded-xl border border-[var(--color-line)] bg-white p-5 shadow-sm sm:p-6">
        <h2 className="mb-4 font-display text-lg font-semibold text-[var(--color-ink)]">Crear nuevo pendiente</h2>
        <form onSubmit={crearPendiente} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className={`${labelClass} lg:col-span-2`}>
            Descripción
            <input
              required
              type="text"
              value={descripcion}
              onChange={(event) => setDescripcion(event.target.value)}
              disabled={guardando}
              className={inputClass}
              placeholder="Descripción del pendiente"
            />
          </label>
          <label className={labelClass}>
            Monto
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={monto}
              onChange={(event) => setMonto(event.target.value)}
              disabled={guardando}
              className={inputClass}
              placeholder="0.00"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading || guardando}
              className="w-full rounded-lg bg-[var(--color-navy-800)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-navy-900)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {guardando ? "Guardando…" : "Crear pendiente"}
            </button>
          </div>
          <div className={labelClass}>
            <span>Actividad <span className="font-normal">(opcional)</span></span>
            <SelectConCrear
              opciones={actividades}
              valor={actividadId}
              onChange={setActividadId}
              onCrear={crearActividad}
              puedeCrear={puedeCrear}
              disabled={loading || guardando}
              placeholder="Sin actividad"
              className={inputClass}
              ariaLabel="Actividad"
            />
          </div>
          <div className={`${labelClass} sm:col-span-2`}>
            <span>Responsable <span className="font-normal">(opcional)</span></span>
            <SelectConCrear
              opciones={responsables}
              valor={responsableId}
              onChange={setResponsableId}
              onCrear={crearResponsable}
              puedeCrear={puedeCrear}
              disabled={loading || guardando}
              placeholder="Sin responsable"
              className={inputClass}
              ariaLabel="Responsable"
            />
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-[var(--color-line)] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)] px-4 py-4">
          <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">Historial de pendientes</h2>
          <div className="flex rounded-lg border border-[var(--color-line)] p-0.5">
            {(["pendientes", "todos", "pagados"] as const).map((opcion) => (
              <button
                key={opcion}
                type="button"
                onClick={() => setFiltro(opcion)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  filtro === opcion
                    ? "bg-[var(--color-navy-800)] text-white"
                    : "text-[var(--color-ink-soft)] hover:bg-[var(--color-navy-50)]"
                }`}
              >
                {opcion === "pendientes" ? "Solo pendientes" : opcion === "pagados" ? "Solo pagados" : "Todos"}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)] bg-[var(--color-navy-50)]">
                <th className="px-3 py-2.5 text-left font-medium text-[var(--color-ink-soft)]">Descripción</th>
                <th className="px-3 py-2.5 text-right font-medium text-[var(--color-ink-soft)]">Monto</th>
                <th className="px-3 py-2.5 text-left font-medium text-[var(--color-ink-soft)]">Actividad</th>
                <th className="px-3 py-2.5 text-left font-medium text-[var(--color-ink-soft)]">Responsable</th>
                <th className="px-3 py-2.5 text-left font-medium text-[var(--color-ink-soft)]">Estado</th>
                <th className="px-3 py-2.5 text-left font-medium text-[var(--color-ink-soft)]">Fecha de registro</th>
                <th className="px-3 py-2.5 text-right font-medium text-[var(--color-ink-soft)]"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-[var(--color-ink-soft)]">Cargando pendientes…</td></tr>
              ) : pendientesFiltrados.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-[var(--color-ink-soft)]">No hay pendientes para este filtro.</td></tr>
              ) : (
                pendientesFiltrados.map((pendiente) => (
                  <tr key={pendiente.id} className="border-b border-[var(--color-line)] last:border-0 hover:bg-[var(--color-navy-50)]/50">
                    <td className="px-3 py-2.5">{pendiente.descripcion}</td>
                    <td className="px-3 py-2.5 text-right font-medium">{formatoMoneda(Number(pendiente.monto) || 0)}</td>
                    <td className="px-3 py-2.5 text-[var(--color-ink-soft)]">{nombreRelacionado(pendiente.actividad)}</td>
                    <td className="px-3 py-2.5 text-[var(--color-ink-soft)]">{nombreRelacionado(pendiente.responsable)}</td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-md px-2 py-1 text-xs font-medium ${pendiente.estado === "Pagado" ? "bg-[var(--color-ok-bg)] text-[var(--color-ok)]" : "bg-[var(--color-pending-bg)] text-[var(--color-pending)]"}`}>
                        {pendiente.estado}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{pendiente.fecha_registro}</td>
                    <td className="px-3 py-2.5 text-right">
                      {pendiente.estado === "Pendiente" && (
                        <button
                          type="button"
                          onClick={() => marcarComoPagado(pendiente)}
                          disabled={guardando}
                          className="text-xs font-medium text-[var(--color-navy-800)] hover:text-[var(--color-navy-900)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Marcar como pagado
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
