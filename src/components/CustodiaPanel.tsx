"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import SelectConCrear from "@/components/SelectConCrear";
import type { ResumenResponsable } from "@/lib/types";

type TipoCustodia = "Entrega" | "Gasto" | "Devolucion";

interface Responsable {
  id: string;
  nombre: string;
}

interface MovimientoCustodia {
  id: string;
  responsable_id: string;
  tipo: TipoCustodia;
  monto: number;
  fecha: string;
  observaciones: string | null;
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

function nombreResponsable(relacion: { nombre: string }[] | null | undefined) {
  return relacion?.[0]?.nombre ?? "Sin responsable";
}

export default function CustodiaPanel() {
  const supabase = useMemo(() => createClient(), []);
  const [responsables, setResponsables] = useState<Responsable[]>([]);
  const [puedeCrear, setPuedeCrear] = useState(false);
  const [saldos, setSaldos] = useState<ResumenResponsable[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoCustodia[]>([]);
  const [responsableId, setResponsableId] = useState("");
  const [tipo, setTipo] = useState<TipoCustodia>("Entrega");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(hoyISO);
  const [observaciones, setObservaciones] = useState("");
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function cargarDatos() {
    setLoading(true);
    setError(null);

    const [responsablesResult, saldosResult, movimientosResult, rolResult] = await Promise.all([
      supabase
        .from("responsables")
        .select("id, nombre")
        .eq("activo", true)
        .order("nombre"),
      supabase
        .from("vista_dinero_por_responsable")
        .select("*")
        .order("monto", { ascending: false }),
      supabase
        .from("custodia_movimientos")
        .select("id, responsable_id, tipo, monto, fecha, observaciones, responsable:responsables(nombre)")
        .order("fecha", { ascending: false }),
      supabase.rpc("es_administrador"),
    ]);

    const primerError = responsablesResult.error ?? saldosResult.error ?? movimientosResult.error;
    if (primerError) {
      setError(`No se pudo cargar la información de custodia: ${primerError.message}`);
      setLoading(false);
      return;
    }

    setResponsables(responsablesResult.data ?? []);
    setPuedeCrear(rolResult.data === true);
    setSaldos(saldosResult.data ?? []);
    setMovimientos((movimientosResult.data ?? []) as MovimientoCustodia[]);
    setLoading(false);
  }

  useEffect(() => {
    cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

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

  async function registrarMovimiento(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMensaje(null);

    const montoNumerico = Number(monto);
    if (!responsableId || !fecha) {
      setError("Selecciona un responsable e indica la fecha.");
      return;
    }
    if (!Number.isFinite(montoNumerico) || montoNumerico <= 0) {
      setError("El monto debe ser un número mayor que cero.");
      return;
    }

    setGuardando(true);
    const { error: insertError } = await supabase.from("custodia_movimientos").insert({
      responsable_id: responsableId,
      tipo,
      monto: montoNumerico,
      fecha,
      observaciones: observaciones.trim() || null,
    });
    setGuardando(false);

    if (insertError) {
      setError(`No se pudo registrar el movimiento: ${insertError.message}`);
      return;
    }

    setMonto("");
    setObservaciones("");
    setMensaje("Movimiento de custodia registrado correctamente.");
    await cargarDatos();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-[var(--color-ink)]">Custodia</h1>
        <span className="flex items-center gap-1.5 text-xs text-[var(--color-ink-soft)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-ok)] animate-pulse" />
          Control de dinero
        </span>
      </div>

      <section className="mb-8 overflow-hidden rounded-xl border border-[var(--color-line)] bg-white">
        <div className="border-b border-[var(--color-line)] px-4 py-4">
          <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">¿Quién tiene el dinero?</h2>
          <p className="mt-1 text-xs text-[var(--color-ink-soft)]">Saldos actuales por responsable.</p>
        </div>
        {loading ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--color-ink-soft)]">Cargando saldos…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)] bg-[var(--color-navy-50)]">
                  <th className="px-4 py-2.5 text-left font-medium text-[var(--color-ink-soft)]">Responsable</th>
                  <th className="px-4 py-2.5 text-right font-medium text-[var(--color-ink-soft)]">Monto</th>
                </tr>
              </thead>
              <tbody>
                {saldos.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-8 text-center text-[var(--color-ink-soft)]">No hay saldos registrados.</td>
                  </tr>
                ) : (
                  saldos.map((saldo) => (
                    <tr key={saldo.responsable} className="border-b border-[var(--color-line)] last:border-0">
                      <td className="px-4 py-2.5">{saldo.responsable || "Sin responsable"}</td>
                      <td className="px-4 py-2.5 text-right font-medium">{formatoMoneda(Number(saldo.monto) || 0)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {error && (
        <p className="mb-4 rounded-lg bg-[var(--color-pending-bg)] px-3 py-2 text-sm text-[var(--color-pending)]">{error}</p>
      )}
      {mensaje && (
        <p className="mb-4 rounded-lg bg-[var(--color-ok-bg)] px-3 py-2 text-sm text-[var(--color-ok)]">{mensaje}</p>
      )}

      <section className="mb-8 rounded-xl border border-[var(--color-line)] bg-white p-5 shadow-sm sm:p-6">
        <h2 className="mb-4 font-display text-lg font-semibold text-[var(--color-ink)]">Registrar movimiento de custodia</h2>
        <form onSubmit={registrarMovimiento} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="block text-xs font-medium text-[var(--color-ink-soft)]">
            <span>Responsable</span>
            <SelectConCrear
              opciones={responsables}
              valor={responsableId}
              onChange={setResponsableId}
              onCrear={crearResponsable}
              puedeCrear={puedeCrear}
              required
              disabled={loading || guardando}
              placeholder="Selecciona un responsable"
              className="mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-navy-700)]"
              ariaLabel="Responsable"
            />
          </div>

          <label className="block text-xs font-medium text-[var(--color-ink-soft)]">
            Tipo
            <select
              value={tipo}
              onChange={(event) => setTipo(event.target.value as TipoCustodia)}
              disabled={guardando}
              className="mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-navy-700)]"
            >
              <option value="Entrega">Entrega</option>
              <option value="Gasto">Gasto</option>
              <option value="Devolucion">Devolución</option>
            </select>
          </label>

          <label className="block text-xs font-medium text-[var(--color-ink-soft)]">
            Monto
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={monto}
              onChange={(event) => setMonto(event.target.value)}
              disabled={guardando}
              className="mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-navy-700)]"
              placeholder="0.00"
            />
          </label>

          <label className="block text-xs font-medium text-[var(--color-ink-soft)]">
            Fecha
            <input
              required
              type="date"
              value={fecha}
              onChange={(event) => setFecha(event.target.value)}
              disabled={guardando}
              className="mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-navy-700)]"
            />
          </label>

          <label className="block text-xs font-medium text-[var(--color-ink-soft)] sm:col-span-2">
            Observaciones
            <textarea
              value={observaciones}
              onChange={(event) => setObservaciones(event.target.value)}
              disabled={guardando}
              className="mt-1 min-h-11 w-full resize-y rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-navy-700)]"
              placeholder="Opcional"
            />
          </label>

          <div className="flex items-end lg:justify-end">
            <button
              type="submit"
              disabled={loading || guardando}
              className="w-full rounded-lg bg-[var(--color-navy-800)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-navy-900)] disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto"
            >
              {guardando ? "Guardando…" : "Registrar movimiento"}
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-[var(--color-line)] bg-white">
        <div className="border-b border-[var(--color-line)] px-4 py-4">
          <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">Historial de custodia</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)] bg-[var(--color-navy-50)]">
                <th className="px-4 py-2.5 text-left font-medium text-[var(--color-ink-soft)]">Responsable</th>
                <th className="px-4 py-2.5 text-left font-medium text-[var(--color-ink-soft)]">Tipo</th>
                <th className="px-4 py-2.5 text-right font-medium text-[var(--color-ink-soft)]">Monto</th>
                <th className="px-4 py-2.5 text-left font-medium text-[var(--color-ink-soft)]">Fecha</th>
                <th className="px-4 py-2.5 text-left font-medium text-[var(--color-ink-soft)]">Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-[var(--color-ink-soft)]">Cargando historial…</td></tr>
              ) : movimientos.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-[var(--color-ink-soft)]">Aún no hay movimientos de custodia.</td></tr>
              ) : (
                movimientos.map((movimiento) => (
                  <tr key={movimiento.id} className="border-b border-[var(--color-line)] last:border-0">
                    <td className="px-4 py-2.5">{nombreResponsable(movimiento.responsable)}</td>
                    <td className="px-4 py-2.5">{movimiento.tipo === "Devolucion" ? "Devolución" : movimiento.tipo}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{formatoMoneda(Number(movimiento.monto) || 0)}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{movimiento.fecha}</td>
                    <td className="px-4 py-2.5 text-[var(--color-ink-soft)]">{movimiento.observaciones || "—"}</td>
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
