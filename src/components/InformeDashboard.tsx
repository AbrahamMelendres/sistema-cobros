"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Registro } from "@/lib/types";

function formatFecha(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const label = d.toLocaleDateString("es-BO", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

interface ResumenDia {
  fecha: string;
  encargada: string;
  registros: number;
  cancelados: number;
  pendientes: number;
  totalCobrado: number;
}

export default function InformeDashboard() {
  const supabase = useMemo(() => createClient(), []);
  const [todos, setTodos] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(true);

  async function cargar() {
    const { data } = await supabase
      .from("registros")
      .select("*")
      .order("fecha", { ascending: false });
    setTodos(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    cargar();

    const channel = supabase
      .channel("registros-informe")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "registros" },
        () => cargar()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const porDia: ResumenDia[] = useMemo(() => {
    const mapa = new Map<string, ResumenDia>();
    for (const r of todos) {
      const key = r.fecha;
      const actual =
        mapa.get(key) ??
        ({
          fecha: key,
          encargada: r.encargada ?? "—",
          registros: 0,
          cancelados: 0,
          pendientes: 0,
          totalCobrado: 0,
        } as ResumenDia);

      actual.registros += 1;
      const pagoRealizado = r.estado_pago ?? (r.estado === "Cancelado" ? "Pagado" : "Pendiente");
      if (pagoRealizado === "Pagado") {
        actual.cancelados += 1;
        actual.totalCobrado += Number(r.monto) || 0;
      } else {
        actual.pendientes += 1;
      }
      if (r.encargada) actual.encargada = r.encargada;

      mapa.set(key, actual);
    }
    return Array.from(mapa.values()).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  }, [todos]);

  const totales = useMemo(() => {
    const pagados = todos.filter((r) =>
      (r.estado_pago ?? (r.estado === "Cancelado" ? "Pagado" : "Pendiente")) === "Pagado"
    );
    const efectivo = pagados.filter((r) => r.metodo_pago === "Efectivo").length;
    const qr = pagados.filter((r) => r.metodo_pago === "QR").length;
    const pendientes = todos.filter((r) =>
      (r.estado_pago ?? (r.estado === "Cancelado" ? "Pagado" : "Pendiente")) === "Pendiente"
    ).length;
    const totalCobrado = pagados.reduce((sum, r) => sum + (Number(r.monto) || 0), 0);
    return {
      registros: todos.length,
      cancelados: pagados.length,
      pendientes,
      efectivo,
      qr,
      totalCobrado,
    };
  }, [todos]);

  const tarjetas = [
    { label: "Total de registros", valor: totales.registros },
    { label: "Pagados", valor: totales.cancelados, tono: "ok" as const },
    { label: "Pendientes", valor: totales.pendientes, tono: "pending" as const },
    { label: "Recaudado (Bs)", valor: totales.totalCobrado },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-semibold">Informe general</h1>
        <span className="flex items-center gap-1.5 text-xs text-[var(--color-ink-soft)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-ok)] animate-pulse" />
          En vivo
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {tarjetas.map((t) => (
          <div
            key={t.label}
            className="bg-white rounded-xl border border-[var(--color-line)] px-4 py-4"
          >
            <p className="text-xs text-[var(--color-ink-soft)] mb-1">{t.label}</p>
            <p
              className={`font-display text-2xl font-semibold ${
                t.tono === "ok"
                  ? "text-[var(--color-ok)]"
                  : t.tono === "pending"
                  ? "text-[var(--color-pending)]"
                  : "text-[var(--color-ink)]"
              }`}
            >
              {t.valor}
            </p>
          </div>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mb-8">
        <div className="bg-white rounded-xl border border-[var(--color-line)] px-4 py-4">
          <p className="text-xs text-[var(--color-ink-soft)] mb-2">Método de pago (pagados)</p>
          <div className="flex gap-6">
            <div>
              <p className="font-display text-xl font-semibold">{totales.efectivo}</p>
              <p className="text-xs text-[var(--color-ink-soft)]">Efectivo</p>
            </div>
            <div>
              <p className="font-display text-xl font-semibold">{totales.qr}</p>
              <p className="text-xs text-[var(--color-ink-soft)]">QR</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[var(--color-line)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)] bg-[var(--color-navy-50)]">
                <th className="text-left font-medium text-[var(--color-ink-soft)] px-3 py-2.5">Día</th>
                <th className="text-left font-medium text-[var(--color-ink-soft)] px-3 py-2.5">Encargada</th>
                <th className="text-left font-medium text-[var(--color-ink-soft)] px-3 py-2.5">Registros</th>
                <th className="text-left font-medium text-[var(--color-ink-soft)] px-3 py-2.5">Pagados</th>
                <th className="text-left font-medium text-[var(--color-ink-soft)] px-3 py-2.5">Pendientes</th>
                <th className="text-left font-medium text-[var(--color-ink-soft)] px-3 py-2.5">Total (Bs)</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-[var(--color-ink-soft)]">
                    Cargando…
                  </td>
                </tr>
              )}
              {!loading && porDia.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-[var(--color-ink-soft)]">
                    Aún no hay datos registrados.
                  </td>
                </tr>
              )}
              {porDia.map((d) => (
                <tr key={d.fecha} className="border-b border-[var(--color-line)] last:border-0">
                  <td className="px-3 py-2.5">{formatFecha(d.fecha)}</td>
                  <td className="px-3 py-2.5 text-[var(--color-ink-soft)]">{d.encargada}</td>
                  <td className="px-3 py-2.5">{d.registros}</td>
                  <td className="px-3 py-2.5 text-[var(--color-ok)]">{d.cancelados}</td>
                  <td className="px-3 py-2.5 text-[var(--color-pending)]">{d.pendientes}</td>
                  <td className="px-3 py-2.5 font-medium">{d.totalCobrado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
