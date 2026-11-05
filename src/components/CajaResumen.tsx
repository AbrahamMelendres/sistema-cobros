"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ResumenCaja, ResumenResponsable } from "@/lib/types";

const resumenInicial: ResumenCaja = {
  total_ingresos: 0,
  total_egresos: 0,
  pendientes_por_pagar: 0,
  saldo_actual: 0,
  saldo_neto: 0,
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
  const [mostrarSaldosCero, setMostrarSaldosCero] = useState(false);

  useEffect(() => {
    async function cargarResumen() {
      setLoading(true);
      setError(null);

      const [cajaResult, responsablesResult] = await Promise.all([
        supabase.from("vista_resumen_caja").select("*").limit(1).maybeSingle(),
        supabase
          .from("vista_dinero_por_responsable")
          .select("*")
          .order("dinero_bajo_responsabilidad", { ascending: false }),
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
    { label: "Saldo disponible", detalle: "Saldo actual en caja", valor: resumen.saldo_actual, tono: "primary" },
    { label: "Ingresos", detalle: "Total acumulado", valor: resumen.total_ingresos, tono: "ok" },
    { label: "Egresos", detalle: "Total acumulado", valor: resumen.total_egresos },
    { label: "Pendientes", detalle: "Por pagar", valor: resumen.pendientes_por_pagar, tono: "pending" },
    { label: "Saldo neto", detalle: "Después de pendientes", valor: resumen.saldo_neto },
  ];
  const saldoNetoEsperado =
    Number(resumen.total_ingresos) -
    Number(resumen.total_egresos) -
    Number(resumen.pendientes_por_pagar);
  const diferenciaSaldoNeto =
    Math.abs(Number(resumen.saldo_neto) - saldoNetoEsperado) > 0.01;
  const responsablesVisibles = mostrarSaldosCero
    ? responsables
    : responsables.filter((item) => Math.abs(Number(item.dinero_bajo_responsabilidad) || 0) > 0.005);
  const responsablesOcultos = responsables.length - responsablesVisibles.length;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">Caja</h1>
        <span className="flex items-center gap-1.5 text-xs text-[var(--color-ink-soft)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-ok)] animate-pulse" />
          Resumen general
        </span>
      </div>

      <nav aria-label="Accesos rápidos de caja" className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          { href: "/caja/movimientos", titulo: "Registrar movimiento", detalle: "Agregar un ingreso o egreso" },
          { href: "/caja/control-dinero?vista=pendientes", titulo: "Ver pendientes", detalle: "Consultar y actualizar pendientes" },
          { href: "/caja/control-dinero?vista=custodia", titulo: "Revisar custodia", detalle: "Ver dinero por responsable" },
        ].map((acceso) => (
          <Link
            key={acceso.href}
            href={acceso.href}
            className="group rounded-xl border border-[var(--color-line)] bg-white px-4 py-3 transition-colors hover:border-[var(--color-navy-700)] hover:bg-[var(--color-navy-50)]"
          >
            <span className="block text-sm font-semibold text-[var(--color-ink)] transition-colors group-hover:text-[#7dd3fc]">{acceso.titulo}</span>
            <span className="mt-1 block text-xs text-[var(--color-ink-soft)]">{acceso.detalle}</span>
          </Link>
        ))}
      </nav>

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
          {diferenciaSaldoNeto && (
            <p role="status" className="mb-4 rounded-lg border border-[var(--color-pending)] bg-[var(--color-pending-bg)] px-3 py-2 text-sm text-[var(--color-pending)]">
              Revisa el resumen: el saldo neto informado ({formatoMoneda(Number(resumen.saldo_neto) || 0)}) no coincide con ingresos menos egresos y pendientes por pagar ({formatoMoneda(saldoNetoEsperado)}).
            </p>
          )}

          <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
            {tarjetas.map((tarjeta) => (
              <div
                key={tarjeta.label}
                className={`rounded-xl border bg-white px-4 py-4 ${
                  tarjeta.tono === "primary"
                    ? "border-[var(--color-navy-700)] ring-1 ring-[var(--color-navy-700)]"
                    : "border-[var(--color-line)]"
                }`}
              >
                <p className="text-sm font-medium text-[var(--color-ink)]">{tarjeta.label}</p>
                <p className="mb-1 text-xs text-[var(--color-ink-soft)]">{tarjeta.detalle}</p>
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
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)] px-4 py-4">
              <div>
                <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">Dinero por responsable</h2>
                <p className="mt-1 text-xs text-[var(--color-ink-soft)]">Saldos bajo responsabilidad de cada persona.</p>
              </div>
              <label className="flex items-center gap-2 text-xs text-[var(--color-ink-soft)]">
                <input
                  type="checkbox"
                  checked={mostrarSaldosCero}
                  onChange={(event) => setMostrarSaldosCero(event.target.checked)}
                  className="h-4 w-4 accent-[var(--color-navy-800)]"
                />
                Mostrar saldos en cero
              </label>
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
                  {responsablesVisibles.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-4 py-8 text-center text-[var(--color-ink-soft)]">
                        {responsables.length === 0
                          ? "No hay responsables con dinero registrado."
                          : "No hay saldos distintos de cero para mostrar."}
                      </td>
                    </tr>
                  ) : (
                    responsablesVisibles.map((item) => {
                      const saldo = Number(item.dinero_bajo_responsabilidad) || 0;
                      return (
                      <tr key={item.responsable} className="border-b border-[var(--color-line)] last:border-0">
                        <td className="px-4 py-2.5">{item.responsable || "Sin responsable"}</td>
                        <td className={`px-4 py-2.5 text-right font-medium ${saldo < -0.005 ? "text-[var(--color-pending)]" : ""}`}>
                          {formatoMoneda(saldo)}
                          {saldo < -0.005 && <span className="ml-2 text-xs">Revisar</span>}
                        </td>
                      </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {responsablesOcultos > 0 && !mostrarSaldosCero && (
              <p className="border-t border-[var(--color-line)] px-4 py-2 text-xs text-[var(--color-ink-soft)]">
                {responsablesOcultos} responsable{responsablesOcultos === 1 ? "" : "s"} con saldo cero oculto{responsablesOcultos === 1 ? "" : "s"}.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}