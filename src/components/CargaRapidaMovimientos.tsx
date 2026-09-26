"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import SelectConCrear from "@/components/SelectConCrear";

type TipoMovimiento = "Ingreso" | "Egreso";
type MetodoPago = "Efectivo" | "QR" | "";

interface OpcionCatalogo {
  id: string;
  nombre: string;
}

interface FilaMovimiento {
  id: string;
  fecha: string;
  actividad_id: string;
  tipo: TipoMovimiento | "";
  concepto: string;
  monto: string;
  metodo_pago: MetodoPago;
  responsable_id: string;
}

function hoyISO() {
  const fecha = new Date();
  const diferenciaZona = fecha.getTimezoneOffset();
  const fechaLocal = new Date(fecha.getTime() - diferenciaZona * 60000);
  return fechaLocal.toISOString().slice(0, 10);
}

function filaVacia(): FilaMovimiento {
  return {
    id: crypto.randomUUID(),
    fecha: hoyISO(),
    actividad_id: "",
    tipo: "",
    concepto: "",
    monto: "",
    metodo_pago: "",
    responsable_id: "",
  };
}

function filaCompleta(fila: FilaMovimiento) {
  const monto = Number(fila.monto);
  return Boolean(
    fila.fecha &&
      fila.actividad_id &&
      fila.tipo &&
      fila.responsable_id &&
      fila.concepto.trim() &&
      Number.isFinite(monto) &&
      monto > 0
  );
}

export default function CargaRapidaMovimientos() {
  const supabase = useMemo(() => createClient(), []);
  const [actividades, setActividades] = useState<OpcionCatalogo[]>([]);
  const [responsables, setResponsables] = useState<OpcionCatalogo[]>([]);
  const [puedeCrear, setPuedeCrear] = useState(false);
  const [filas, setFilas] = useState<FilaMovimiento[]>([]);
  const [filasInvalidas, setFilasInvalidas] = useState<Set<string>>(new Set());
  const [loadingCatalogos, setLoadingCatalogos] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    async function cargarCatalogos() {
      setLoadingCatalogos(true);
      setError(null);

      const [actividadesResult, responsablesResult, rolResult] = await Promise.all([
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

      if (actividadesResult.error || responsablesResult.error) {
        setError(
          actividadesResult.error?.message ??
            responsablesResult.error?.message ??
            "No se pudieron cargar las opciones del formulario."
        );
        setLoadingCatalogos(false);
        return;
      }

      setActividades(actividadesResult.data ?? []);
      setResponsables(responsablesResult.data ?? []);
      setPuedeCrear(rolResult.data === true);
      setLoadingCatalogos(false);
    }

    cargarCatalogos();
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

  function agregarFila() {
    setFilas((actuales) => [...actuales, filaVacia()]);
    setError(null);
    setMensaje(null);
  }

  function actualizarFila<K extends keyof FilaMovimiento>(
    id: string,
    campo: K,
    valor: FilaMovimiento[K]
  ) {
    setFilas((actuales) =>
      actuales.map((fila) => (fila.id === id ? { ...fila, [campo]: valor } : fila))
    );
    setFilasInvalidas((actuales) => {
      const siguientes = new Set(actuales);
      siguientes.delete(id);
      return siguientes;
    });
    setError(null);
    setMensaje(null);
  }

  async function guardarTodo() {
    setError(null);
    setMensaje(null);

    if (filas.length === 0) {
      setError("Agrega al menos una fila antes de guardar.");
      return;
    }

    const invalidas = new Set(filas.filter((fila) => !filaCompleta(fila)).map((fila) => fila.id));
    if (invalidas.size > 0) {
      setFilasInvalidas(invalidas);
      setError("Completa las filas resaltadas en rojo antes de guardar.");
      return;
    }

    setGuardando(true);
    const movimientos = filas.map((fila) => ({
      fecha: fila.fecha,
      actividad_id: fila.actividad_id,
      tipo: fila.tipo,
      concepto: fila.concepto.trim(),
      monto: Number(fila.monto),
      metodo_pago: fila.metodo_pago || null,
      responsable_id: fila.responsable_id,
      origen: "manual",
    }));

    const { error: insertError } = await supabase.from("movimientos").insert(movimientos);
    setGuardando(false);

    if (insertError) {
      setError(`No se pudieron guardar los movimientos: ${insertError.message}`);
      return;
    }

    setFilas([]);
    setFilasInvalidas(new Set());
    setMensaje(`${movimientos.length} movimiento(s) guardado(s) correctamente.`);
  }

  const inputClass = "rounded-md border border-[var(--color-line)] bg-white px-2 py-1.5 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-navy-700)] focus:ring-2 focus:ring-[var(--color-navy-100)]";

  return (
    <section className="mt-6 rounded-xl border border-[var(--color-line)] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)] px-4 py-4 sm:px-5">
        <div>
          <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">Carga rápida de movimientos</h2>
          <p className="mt-1 text-xs text-[var(--color-ink-soft)]">Agrega varias filas y guárdalas juntas.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={agregarFila}
            disabled={loadingCatalogos || guardando}
            className="rounded-lg border border-[var(--color-line)] bg-white px-3 py-2 text-sm font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-navy-50)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Agregar fila
          </button>
          <button
            type="button"
            onClick={guardarTodo}
            disabled={loadingCatalogos || guardando || filas.length === 0}
            className="rounded-lg bg-[var(--color-navy-800)] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-navy-900)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {guardando ? "Guardando…" : "Guardar todo"}
          </button>
        </div>
      </div>

      {loadingCatalogos && (
        <p className="m-4 rounded-lg bg-[var(--color-navy-50)] px-3 py-2 text-sm text-[var(--color-ink-soft)]">
          Cargando actividades y responsables…
        </p>
      )}
      {error && (
        <p className="m-4 rounded-lg bg-[var(--color-pending-bg)] px-3 py-2 text-sm text-[var(--color-pending)]">
          {error}
        </p>
      )}
      {mensaje && (
        <p className="m-4 rounded-lg bg-[var(--color-ok-bg)] px-3 py-2 text-sm text-[var(--color-ok)]">
          {mensaje}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] text-sm">
          <thead>
            <tr className="border-b border-[var(--color-line)] bg-[var(--color-navy-50)]">
              <th className="px-3 py-2.5 text-left font-medium text-[var(--color-ink-soft)]">Fecha</th>
              <th className="px-3 py-2.5 text-left font-medium text-[var(--color-ink-soft)]">Actividad</th>
              <th className="px-3 py-2.5 text-left font-medium text-[var(--color-ink-soft)]">Tipo</th>
              <th className="px-3 py-2.5 text-left font-medium text-[var(--color-ink-soft)]">Concepto</th>
              <th className="px-3 py-2.5 text-left font-medium text-[var(--color-ink-soft)]">Monto</th>
              <th className="px-3 py-2.5 text-left font-medium text-[var(--color-ink-soft)]">Método</th>
              <th className="px-3 py-2.5 text-left font-medium text-[var(--color-ink-soft)]">Responsable</th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-[var(--color-ink-soft)]">
                  No hay filas pendientes. Usa “Agregar fila” para comenzar.
                </td>
              </tr>
            ) : (
              filas.map((fila) => (
                <tr
                  key={fila.id}
                  className={`border-b border-[var(--color-line)] last:border-0 ${
                    filasInvalidas.has(fila.id) ? "border-l-4 border-l-red-500 bg-red-50" : ""
                  }`}
                >
                  <td className="px-2 py-2">
                    <input
                      type="date"
                      value={fila.fecha}
                      onChange={(event) => actualizarFila(fila.id, "fecha", event.target.value)}
                      disabled={guardando}
                      className={inputClass}
                      aria-label="Fecha del movimiento"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <SelectConCrear
                      opciones={actividades}
                      valor={fila.actividad_id}
                      onChange={(valor) => actualizarFila(fila.id, "actividad_id", valor)}
                      onCrear={crearActividad}
                      puedeCrear={puedeCrear}
                      disabled={loadingCatalogos || guardando}
                      placeholder="Selecciona"
                      className={`${inputClass} w-44`}
                      ariaLabel="Actividad del movimiento"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <select
                      value={fila.tipo}
                      onChange={(event) => actualizarFila(fila.id, "tipo", event.target.value as TipoMovimiento | "")}
                      disabled={guardando}
                      className={`${inputClass} w-28`}
                      aria-label="Tipo del movimiento"
                    >
                      <option value="">Selecciona</option>
                      <option value="Ingreso">Ingreso</option>
                      <option value="Egreso">Egreso</option>
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={fila.concepto}
                      onChange={(event) => actualizarFila(fila.id, "concepto", event.target.value)}
                      disabled={guardando}
                      className={`${inputClass} w-52`}
                      placeholder="Concepto"
                      aria-label="Concepto del movimiento"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={fila.monto}
                      onChange={(event) => actualizarFila(fila.id, "monto", event.target.value)}
                      disabled={guardando}
                      className={`${inputClass} w-28`}
                      placeholder="0.00"
                      aria-label="Monto del movimiento"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <select
                      value={fila.metodo_pago}
                      onChange={(event) => actualizarFila(fila.id, "metodo_pago", event.target.value as MetodoPago)}
                      disabled={guardando}
                      className={`${inputClass} w-32`}
                      aria-label="Método de pago"
                    >
                      <option value="">Sin especificar</option>
                      <option value="Efectivo">Efectivo</option>
                      <option value="QR">QR</option>
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <SelectConCrear
                      opciones={responsables}
                      valor={fila.responsable_id}
                      onChange={(valor) => actualizarFila(fila.id, "responsable_id", valor)}
                      onCrear={crearResponsable}
                      puedeCrear={puedeCrear}
                      disabled={loadingCatalogos || guardando}
                      placeholder="Selecciona"
                      className={`${inputClass} w-44`}
                      ariaLabel="Responsable del movimiento"
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
