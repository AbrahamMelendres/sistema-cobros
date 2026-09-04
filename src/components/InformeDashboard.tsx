"use client";

import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
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

function fechaLocalISO(fecha: Date) {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function rangoDelPeriodo(periodo: Periodo, fechaReferencia: string) {
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

type Periodo = "dia" | "semana" | "mes";

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
  const [periodo, setPeriodo] = useState<Periodo>("dia");
  const [fechaReferencia, setFechaReferencia] = useState(() => fechaLocalISO(new Date()));

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

  const registrosDelPeriodo = useMemo(() => {
    const rango = rangoDelPeriodo(periodo, fechaReferencia);
    return todos.filter((registro) => registro.fecha >= rango.inicio && registro.fecha <= rango.fin);
  }, [fechaReferencia, periodo, todos]);

  const porDia: ResumenDia[] = useMemo(() => {
    const mapa = new Map<string, ResumenDia>();
    for (const r of registrosDelPeriodo) {
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
  }, [registrosDelPeriodo]);

  const totales = useMemo(() => {
    const pagados = registrosDelPeriodo.filter((r) =>
      (r.estado_pago ?? (r.estado === "Cancelado" ? "Pagado" : "Pendiente")) === "Pagado"
    );
    const efectivo = pagados.filter((r) => r.metodo_pago === "Efectivo").length;
    const qr = pagados.filter((r) => r.metodo_pago === "QR").length;
    const pendientes = registrosDelPeriodo.filter((r) =>
      (r.estado_pago ?? (r.estado === "Cancelado" ? "Pagado" : "Pendiente")) === "Pendiente"
    ).length;
    const totalCobrado = pagados.reduce((sum, r) => sum + (Number(r.monto) || 0), 0);
    return {
      registros: registrosDelPeriodo.length,
      cancelados: pagados.length,
      pendientes,
      efectivo,
      qr,
      totalCobrado,
    };
  }, [registrosDelPeriodo]);

  const tarjetas = [
    { label: "Total de registros", valor: totales.registros },
    { label: "Pagados", valor: totales.cancelados, tono: "ok" as const },
    { label: "Pendientes", valor: totales.pendientes, tono: "pending" as const },
    { label: "Recaudado (Bs)", valor: totales.totalCobrado },
  ];

  async function exportarPdf() {
    const element = document.getElementById("informe-pdf");
    if (!element) return;

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("l", "pt", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 24;
    const imgWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    pdf.addImage(imgData, "PNG", margin, margin, imgWidth, imgHeight, undefined, "FAST");

    if (imgHeight > pageHeight - margin * 2) {
      const adjustedHeight = pageHeight - margin * 2;
      const adjustedWidth = (canvas.width * adjustedHeight) / canvas.height;
      pdf.deletePage(1);
      pdf.addImage(imgData, "PNG", margin, margin, adjustedWidth, adjustedHeight, undefined, "FAST");
    }

    pdf.save(`informe-general-${periodo}.pdf`);
  }

  const tituloPeriodo = (() => {
    const rango = rangoDelPeriodo(periodo, fechaReferencia);
    return periodo === "dia"
      ? `Día ${formatFecha(rango.inicio)}`
      : periodo === "semana"
      ? `Semana ${formatFecha(rango.inicio)} - ${formatFecha(rango.fin)}`
      : `Mes ${formatFecha(rango.inicio)} - ${formatFecha(rango.fin)}`;
  })();

  return (
    <div id="informe-pdf" className="report-print-area">
      <div className="mb-6 rounded-xl border border-[var(--color-line)] bg-white px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-navy-800)] text-sm font-semibold text-white">
              RC
            </div>
            <div>
              <p className="font-display text-base font-semibold text-[var(--color-ink)]">Registro de Cobros</p>
              <p className="text-xs text-[var(--color-ink-soft)]">Academia Técnica de Ingeniería y Tecnologías Informáticas</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.12em] text-[var(--color-ink-soft)]">Informe</p>
            <p className="font-display text-lg font-semibold text-[var(--color-ink)]">{tituloPeriodo}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-semibold">Informe general</h1>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={exportarPdf}
            className="no-print rounded-lg bg-[var(--color-navy-800)] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-navy-900)]"
          >
            Generar PDF
          </button>
          <span className="no-print flex items-center gap-1.5 text-xs text-[var(--color-ink-soft)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-ok)] animate-pulse" />
            En vivo
          </span>
        </div>
      </div>

      <div className="no-print mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--color-line)] bg-white p-3">
        <div>
          <span className="mb-1.5 block text-xs font-medium text-[var(--color-ink-soft)]">Período del informe</span>
          <div className="flex rounded-lg border border-[var(--color-line)] p-0.5">
            {(["dia", "semana", "mes"] as const).map((opcion) => (
              <button
                key={opcion}
                type="button"
                onClick={() => setPeriodo(opcion)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  periodo === opcion
                    ? "bg-[var(--color-navy-800)] text-white"
                    : "text-[var(--color-ink-soft)] hover:bg-[var(--color-navy-50)]"
                }`}
              >
                {opcion === "dia" ? "Día" : opcion === "semana" ? "Semana" : "Mes"}
              </button>
            ))}
          </div>
        </div>
        <label className="text-xs font-medium text-[var(--color-ink-soft)]">
          Fecha de referencia
          <input
            type="date"
            value={fechaReferencia}
            onChange={(e) => setFechaReferencia(e.target.value)}
            className="mt-1 block rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-sm font-normal text-[var(--color-ink)]"
          />
        </label>
        <p className="pb-1 text-xs text-[var(--color-ink-soft)]">
          {(() => {
            const rango = rangoDelPeriodo(periodo, fechaReferencia);
            return periodo === "dia"
              ? formatFecha(rango.inicio)
              : `${formatFecha(rango.inicio)} a ${formatFecha(rango.fin)}`;
          })()}
        </p>
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
