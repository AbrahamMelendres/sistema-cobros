"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

interface Movimiento {
  id: string;
  fecha: string;
  tipo: "Ingreso" | "Egreso";
  concepto: string;
  monto: number;
  metodo_pago: string | null;
  actividad: { nombre: string }[] | null;
  responsable: { nombre: string }[] | null;
}

function formatoMoneda(valor: number) {
  return `${valor.toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} Bs`;
}

function nombreRelacionado(relacion: { nombre: string }[] | null) {
  return relacion?.[0]?.nombre ?? "—";
}

function fechaLocalISO() {
  const fecha = new Date();
  const zona = fecha.getTimezoneOffset();
  return new Date(fecha.getTime() - zona * 60_000).toISOString().slice(0, 10);
}

export default function ListaMovimientos() {
  const supabase = useMemo(() => createClient(), []);
  const { isAdmin: administrador, loading: verificandoRol, error: roleError } = useUserRole(supabase);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportando, setExportando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function exportarExcel() {
    if (movimientos.length === 0) return;

    setExportando(true);
    setError(null);
    try {
      const XLSX = await import("xlsx");
      const filas = movimientos.map((movimiento) => ({
        Fecha: movimiento.fecha,
        Actividad: nombreRelacionado(movimiento.actividad),
        Tipo: movimiento.tipo,
        Concepto: movimiento.concepto,
        "Monto (Bs)": Number(movimiento.monto) || 0,
        "Método de pago": movimiento.metodo_pago ?? "Sin especificar",
        Responsable: nombreRelacionado(movimiento.responsable),
      }));
      const hoja = XLSX.utils.json_to_sheet(filas);
      hoja["!cols"] = [
        { wch: 14 },
        { wch: 24 },
        { wch: 12 },
        { wch: 36 },
        { wch: 16 },
        { wch: 20 },
        { wch: 24 },
      ];

      const libro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(libro, hoja, "Movimientos");
      XLSX.writeFile(libro, `movimientos-recientes-${fechaLocalISO()}.xlsx`);
    } catch (exportError) {
      setError(
        `No se pudo exportar a Excel: ${
          exportError instanceof Error ? exportError.message : "Error inesperado."
        }`
      );
    } finally {
      setExportando(false);
    }
  }

  const cargarMovimientos = useCallback(async (mostrarCarga = false) => {
    if (mostrarCarga) setLoading(true);
    setError(null);

    const { data, error: queryError } = await supabase
      .from("movimientos")
      .select("id, fecha, tipo, concepto, monto, metodo_pago, actividad:actividades(nombre), responsable:responsables(nombre)")
      .order("fecha", { ascending: false })
      .order("id", { ascending: false })
      .limit(50);

    if (queryError) {
      setError(`No se pudieron cargar los movimientos: ${queryError.message}`);
    } else {
      setMovimientos((data ?? []) as Movimiento[]);
    }

    if (mostrarCarga) setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void cargarMovimientos(true);

    const channel = supabase
      .channel("lista-movimientos")
      .on("postgres_changes", { event: "*", schema: "public", table: "movimientos" }, () => {
        void cargarMovimientos();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [cargarMovimientos, supabase]);

  async function eliminarMovimiento(movimiento: Movimiento) {
    if (!administrador || eliminandoId) return;

    const confirmacion = [
      "¿Eliminar permanentemente este movimiento?",
      `${movimiento.tipo}: ${movimiento.concepto}`,
      `Monto: ${formatoMoneda(Number(movimiento.monto) || 0)}`,
      "Esta acción no se puede deshacer.",
    ].join("\n");
    if (!window.confirm(confirmacion)) return;

    setEliminandoId(movimiento.id);
    setError(null);
    setMensaje(null);

    const { data, error: deleteError } = await supabase
      .from("movimientos")
      .delete()
      .eq("id", movimiento.id)
      .select("id")
      .maybeSingle();

    setEliminandoId(null);
    if (deleteError) {
      setError(`No se pudo eliminar el movimiento: ${deleteError.message}`);
      return;
    }
    if (!data) {
      setError("No se eliminó el movimiento. Puede que ya no exista o que tu usuario no tenga permisos.");
      return;
    }

    setMensaje("Movimiento eliminado correctamente.");
    await cargarMovimientos();
  }

  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-[var(--color-line)] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)] px-4 py-4 sm:px-5">
        <div>
          <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">Movimientos recientes</h2>
          <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
            Se muestran los últimos 50 movimientos. Solo administradores pueden eliminarlos.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void exportarExcel()}
          disabled={loading || exportando || movimientos.length === 0}
          className="rounded-lg border border-[var(--color-line)] bg-white px-3 py-2 text-sm font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-navy-50)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {exportando ? "Preparando Excel…" : "Exportar a Excel"}
        </button>
      </div>

      {error && (
        <p role="alert" className="m-4 rounded-lg bg-[var(--color-pending-bg)] px-3 py-2 text-sm text-[var(--color-pending)]">
          {error}
        </p>
      )}
      {roleError && (
        <p role="alert" className="m-4 rounded-lg bg-[var(--color-pending-bg)] px-3 py-2 text-sm text-[var(--color-pending)]">
          No se pudo verificar el rol: {roleError}
        </p>
      )}
      {mensaje && (
        <p role="status" className="m-4 rounded-lg bg-[var(--color-ok-bg)] px-3 py-2 text-sm text-[var(--color-ok)]">
          {mensaje}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-[var(--color-line)] bg-[var(--color-navy-50)]">
              <th className="px-3 py-2.5 text-left font-medium text-[var(--color-ink-soft)]">Fecha</th>
              <th className="px-3 py-2.5 text-left font-medium text-[var(--color-ink-soft)]">Actividad</th>
              <th className="px-3 py-2.5 text-left font-medium text-[var(--color-ink-soft)]">Tipo</th>
              <th className="px-3 py-2.5 text-left font-medium text-[var(--color-ink-soft)]">Concepto</th>
              <th className="px-3 py-2.5 text-right font-medium text-[var(--color-ink-soft)]">Monto</th>
              <th className="px-3 py-2.5 text-left font-medium text-[var(--color-ink-soft)]">Método</th>
              <th className="px-3 py-2.5 text-left font-medium text-[var(--color-ink-soft)]">Responsable</th>
              {administrador && <th className="px-3 py-2.5 text-right font-medium text-[var(--color-ink-soft)]">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={administrador ? 8 : 7} className="px-3 py-8 text-center text-[var(--color-ink-soft)]">
                  Cargando movimientos…
                </td>
              </tr>
            )}
            {!loading && !error && movimientos.length === 0 && (
              <tr>
                <td colSpan={administrador ? 8 : 7} className="px-3 py-8 text-center text-[var(--color-ink-soft)]">
                  No hay movimientos registrados.
                </td>
              </tr>
            )}
            {!loading && movimientos.map((movimiento) => (
              <tr key={movimiento.id} className="border-b border-[var(--color-line)] last:border-0">
                <td className="whitespace-nowrap px-3 py-2.5">{movimiento.fecha}</td>
                <td className="px-3 py-2.5">{nombreRelacionado(movimiento.actividad)}</td>
                <td className={`px-3 py-2.5 font-medium ${movimiento.tipo === "Ingreso" ? "text-[var(--color-ok)]" : "text-[var(--color-pending)]"}`}>
                  {movimiento.tipo}
                </td>
                <td className="max-w-64 px-3 py-2.5">{movimiento.concepto}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right font-medium">{formatoMoneda(Number(movimiento.monto) || 0)}</td>
                <td className="px-3 py-2.5">{movimiento.metodo_pago ?? "—"}</td>
                <td className="px-3 py-2.5">{nombreRelacionado(movimiento.responsable)}</td>
                {administrador && (
                  <td className="px-3 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => void eliminarMovimiento(movimiento)}
                      disabled={verificandoRol || eliminandoId !== null}
                      className="rounded-md border border-[var(--color-line)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-pending)] hover:bg-[var(--color-pending-bg)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {eliminandoId === movimiento.id ? "Eliminando…" : "Eliminar"}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
