"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ResumenCaja, ResumenResponsable } from "@/lib/types";

const resumenInicial: ResumenCaja = {
  total_ingresos: 0,
  total_egresos: 0,
  pendientes_por_pagar: 0,
  saldo_actual: 0,
  saldo_neto_despues_pendientes: 0,
};

function formatoMoneda(valor: number) {
  return `${valor.toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} Bs`;
}

export default function CajaResumen() {
  const supabase = useMemo(() => createClient(), []);
  const [resumen, setResumen] = useState<ResumenCaja>(resumenInicial);
  const [responsables, setResponsables] = useState<ResumenResponsable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function cargarResumen() {
      setLoading(true);
      setError(null);

      const [cajaResult, responsablesResult] = await Promise.all([
        supabase.from("vista_resumen_caja").select("*").limit(1).maybeSingle(),
        supabase.from("vista_dinero_por_responsable").select("*").order("monto", { ascending: false }),
      ]);

      if (cajaResult.error || responsablesResult.error) {
        setError(cajaResult.error?.message ?? responsablesResult.error?.message ?? "No se pudo cargar el resumen de caja.");
        setLoading(false);
        return;
      }

      setResumen(cajaResult.data ?? resumenInicial);
      setResponsables(responsablesResult.data ?? []);
      setLoading(false);
    }

    cargarResumen();
  }, [supabase]);

  const tarjetas = [
    { label: "Total de ingresos", valor: resumen.total_ingresos, tono: "ok" },
    { label: "Total de egresos", valor: resumen.total_egresos },
    { label: "Pendientes por pagar", valor: resumen.pendientes_por_pagar, tono: "pending" },
    { label: "Saldo actual en caja", valor: resumen.saldo_actual },
    { label: "Saldo neto después de pendientes", valor: resumen.saldo_neto_despues_pendientes },
  ];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">Caja</h1>
        <span className="flex items-center gap-1.5 text-xs text-[var(--color-ink-soft)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-ok)] animate-pulse" />
          Resumen general
        </span>
      </div>

      {loading && (
        <div className="mb-6 rounded-xl border border-[var(--color-line)] bg-white px-4 py-8 text-center text-sm text-[var(--color-ink-soft)]">
          Cargando resumen de caja…
        </div>
      )}

      {error && (
        <p className="mb-6 rounded-lg bg-[var(--color-pending-bg)] px-3 py-2 text-sm text-[var(--color-pending)]">
          No se pudo cargar la información de caja: {error}
        </p>
      )}

      {!loading && !error && (
        <>
          <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
            {tarjetas.map((tarjeta) => (
              <div
                key={tarjeta.label}
                className="rounded-xl border border-[var(--color-line)] bg-white px-4 py-4"
              >
                <p className="mb-1 text-xs text-[var(--color-ink-soft)]">{tarjeta.label}</p>
                <p
                  className={`font-display text-2xl font-semibold ${
                    tarjeta.tono === "ok"
                      ? "text-[var(--color-ok)]"
                      : tarjeta.tono === "pending"
                      ? "text-[var(--color-pending)]"
                      : "text-[var(--color-ink)]"
                  }`}
                >
                  {formatoMoneda(Number(tarjeta.valor) || 0)}
                </p>
              </div>
            ))}
          </div>

          <section className="overflow-hidden rounded-xl border border-[var(--color-line)] bg-white">
            <div className="border-b border-[var(--color-line)] px-4 py-4">
              <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">¿Quién tiene el dinero?</h2>
              <p className="mt-1 text-xs text-[var(--color-ink-soft)]">Distribución del dinero por responsable.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-line)] bg-[var(--color-navy-50)]">
                    <th className="px-4 py-2.5 text-left font-medium text-[var(--color-ink-soft)]">Responsable</th>
                    <th className="px-4 py-2.5 text-right font-medium text-[var(--color-ink-soft)]">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {responsables.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-4 py-8 text-center text-[var(--color-ink-soft)]">
                        No hay responsables con dinero registrado.
                      </td>
                    </tr>
                  ) : (
                    responsables.map((item) => (
                      <tr key={item.responsable} className="border-b border-[var(--color-line)] last:border-0">
                        <td className="px-4 py-2.5">{item.responsable || "Sin responsable"}</td>
                        <td className="px-4 py-2.5 text-right font-medium">{formatoMoneda(Number(item.monto) || 0)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}