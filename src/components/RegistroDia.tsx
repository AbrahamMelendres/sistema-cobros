"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Registro, Estado, MetodoPago, TipoEquipo } from "@/lib/types";
import * as XLSX from "xlsx";

const MONTOS_PERMITIDOS = [10, 20, 30] as const;
const COLUMNAS_EXCEL = [
  "Fecha", "N°", "Nombre completo", "CI", "Celular", "Monto (Bs)",
  "Método", "Estado", "Equipo", "Observaciones",
];

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset();
  const local = new Date(d.getTime() - tz * 60000);
  return local.toISOString().slice(0, 10);
}

function formatDiaLabel(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const label = d.toLocaleDateString("es-BO", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function RegistroDia() {
  const supabase = useMemo(() => createClient(), []);
  const [fecha, setFecha] = useState(todayISO());
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [fechasConDatos, setFechasConDatos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [nombreEncargada, setNombreEncargada] = useState<string>("");
  const [importando, setImportando] = useState(false);
  const [mensajeExcel, setMensajeExcel] = useState<string | null>(null);

  useEffect(() => {
    async function cargarPerfil() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("nombre_completo")
        .eq("id", user.id)
        .single();
      setNombreEncargada(data?.nombre_completo ?? user.email ?? "");
    }
    cargarPerfil();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarFechas() {
    const { data } = await supabase
      .from("registros")
      .select("fecha")
      .order("fecha", { ascending: false });

    if (data) {
      const unicas = Array.from(new Set(data.map((r) => r.fecha)));
      setFechasConDatos(unicas.includes(todayISO()) ? unicas : [todayISO(), ...unicas]);
    } else {
      setFechasConDatos([todayISO()]);
    }
  }

  async function cargarRegistros(f: string) {
    setLoading(true);
    const { data } = await supabase
      .from("registros")
      .select("*")
      .eq("fecha", f)
      .order("numero", { ascending: true, nullsFirst: false });
    setRegistros(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    cargarFechas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    cargarRegistros(fecha);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha]);

  async function actualizarCampo(
    id: string,
    campo: keyof Registro,
    valor: string | number | null
  ) {
    if (
      campo === "monto" &&
      !MONTOS_PERMITIDOS.includes(valor as (typeof MONTOS_PERMITIDOS)[number])
    ) {
      return;
    }

    setRegistros((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [campo]: valor } : r))
    );
    setSavingId(id);
    await supabase
      .from("registros")
      .update({ [campo]: valor })
      .eq("id", id);
    setSavingId(null);
  }

  async function agregarFila() {
    const siguienteNumero =
      registros.reduce((max, r) => Math.max(max, r.numero ?? 0), 0) + 1;

    const { data, error } = await supabase
      .from("registros")
      .insert({
        fecha,
        numero: siguienteNumero,
        monto: 10,
        estado: "Pendiente" as Estado,
        encargada: nombreEncargada || null,
      })
      .select()
      .single();

    if (!error && data) {
      setRegistros((prev) => [...prev, data as Registro]);
      if (!fechasConDatos.includes(fecha)) {
        setFechasConDatos((prev) => [fecha, ...prev]);
      }
    }
  }

  async function borrarFila(id: string) {
    if (!confirm("¿Eliminar este registro?")) return;
    setRegistros((prev) => prev.filter((r) => r.id !== id));
    await supabase.from("registros").delete().eq("id", id);
  }

  function exportarExcel() {
    const filas = registros.map((registro) => ({
      Fecha: registro.fecha,
      "N°": registro.numero,
      "Nombre completo": registro.nombre_completo ?? "",
      CI: registro.ci ?? "",
      Celular: registro.celular ?? "",
      "Monto (Bs)": registro.monto,
      Método: registro.metodo_pago ?? "",
      Estado: registro.estado,
      Equipo: registro.tipo_equipo ?? "",
      Observaciones: registro.observaciones ?? "",
    }));
    const hoja = XLSX.utils.json_to_sheet(filas, { header: COLUMNAS_EXCEL });
    hoja["!cols"] = [
      { wch: 12 }, { wch: 6 }, { wch: 28 }, { wch: 14 }, { wch: 16 },
      { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 32 },
    ];
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Registros");
    XLSX.writeFile(libro, `registros-${fecha}.xlsx`);
    setMensajeExcel(`${registros.length} registro(s) exportado(s).`);
  }

  async function importarExcel(event: React.ChangeEvent<HTMLInputElement>) {
    const archivo = event.target.files?.[0];
    event.target.value = "";
    if (!archivo) return;

    setImportando(true);
    setMensajeExcel(null);
    try {
      const libro = XLSX.read(await archivo.arrayBuffer(), { type: "array" });
      const hoja = libro.Sheets[libro.SheetNames[0]];
      const datos = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja);
      const registrosParaInsertar = datos.map((fila, indice) => {
        const fechaFila = String(fila.Fecha ?? fecha).trim();
        const monto = Number(fila["Monto (Bs)"] ?? 10);
        const estado = String(fila.Estado ?? "Pendiente").trim();
        const metodo = String(fila.Método ?? "").trim();
        const equipo = String(fila.Equipo ?? "").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaFila)) {
          throw new Error(`fila ${indice + 2}: fecha inválida`);
        }
        if (![10, 20, 30].includes(monto)) {
          throw new Error(`fila ${indice + 2}: monto debe ser 10, 20 o 30`);
        }
        if (!["Pendiente", "Cancelado"].includes(estado)) {
          throw new Error(`fila ${indice + 2}: estado inválido`);
        }
        if (metodo && !["Efectivo", "QR"].includes(metodo)) {
          throw new Error(`fila ${indice + 2}: método inválido`);
        }
        if (equipo && !["Pc", "Laptop"].includes(equipo)) {
          throw new Error(`fila ${indice + 2}: equipo inválido`);
        }
        return {
          fecha: fechaFila,
          numero: Number(fila["N°"] ?? indice + 1) || indice + 1,
          nombre_completo: String(fila["Nombre completo"] ?? "").trim() || null,
          ci: String(fila.CI ?? "").trim() || null,
          celular: String(fila.Celular ?? "").trim() || null,
          monto,
          metodo_pago: (metodo || null) as MetodoPago | null,
          estado: estado as Estado,
          tipo_equipo: (equipo || null) as TipoEquipo | null,
          observaciones: String(fila.Observaciones ?? "").trim() || null,
          encargada: nombreEncargada || null,
        };
      });
      if (registrosParaInsertar.length === 0) throw new Error("el archivo está vacío");
      const { data, error } = await supabase.from("registros").insert(registrosParaInsertar).select();
      if (error) throw new Error(error.message);
      if (data) {
        await cargarFechas();
        await cargarRegistros(fecha);
        setMensajeExcel(`${data.length} registro(s) importado(s).`);
      }
    } catch (error) {
      setMensajeExcel(error instanceof Error ? `No se importó: ${error.message}` : "No se pudo importar el archivo.");
    } finally {
      setImportando(false);
    }
  }

  const cabecera = [
    "N°",
    "Nombre completo",
    "CI",
    "Celular",
    "Monto (Bs)",
    "Método",
    "Estado",
    "Equipo",
    "Observaciones",
    "",
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="font-display text-2xl font-semibold">
          {formatDiaLabel(fecha)}
        </h1>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
          />
          <button
            onClick={agregarFila}
            className="rounded-lg bg-[var(--color-navy-800)] text-white text-sm font-medium px-4 py-2 hover:bg-[var(--color-navy-900)] transition-colors"
          >
            + Agregar registro
          </button>
          <label className="cursor-pointer rounded-lg border border-[var(--color-line)] bg-white px-3 py-2 text-sm font-medium hover:bg-[var(--color-navy-50)]">
            {importando ? "Importando…" : "Importar Excel"}
            <input type="file" accept=".xlsx,.xls" onChange={importarExcel} disabled={importando} className="sr-only" />
          </label>
          <button
            onClick={exportarExcel}
            disabled={registros.length === 0}
            className="rounded-lg border border-[var(--color-line)] bg-white px-3 py-2 text-sm font-medium hover:bg-[var(--color-navy-50)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Exportar Excel
          </button>
        </div>
      </div>

      {mensajeExcel && (
        <p className="mb-4 rounded-lg bg-[var(--color-navy-50)] px-3 py-2 text-sm text-[var(--color-ink-soft)]">
          {mensajeExcel}
        </p>
      )}

      {fechasConDatos.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {fechasConDatos.map((f) => (
            <button
              key={f}
              onClick={() => setFecha(f)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                f === fecha
                  ? "bg-[var(--color-navy-800)] text-white border-[var(--color-navy-800)]"
                  : "bg-white text-[var(--color-ink-soft)] border-[var(--color-line)] hover:border-[var(--color-navy-700)]"
              }`}
            >
              {formatDiaLabel(f)}
            </button>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border border-[var(--color-line)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)] bg-[var(--color-navy-50)]">
                {cabecera.map((c) => (
                  <th
                    key={c}
                    className="text-left font-medium text-[var(--color-ink-soft)] px-3 py-2.5 whitespace-nowrap"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-[var(--color-ink-soft)]">
                    Cargando…
                  </td>
                </tr>
              )}
              {!loading && registros.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-[var(--color-ink-soft)]">
                    Todavía no hay registros para este día. Usa &ldquo;Agregar registro&rdquo;.
                  </td>
                </tr>
              )}
              {registros.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-[var(--color-line)] last:border-0 hover:bg-[var(--color-navy-50)]/50"
                >
                  <td className="px-3 py-2 text-[var(--color-ink-soft)]">{r.numero}</td>
                  <td className="px-2 py-1">
                    <input
                      defaultValue={r.nombre_completo ?? ""}
                      onBlur={(e) => actualizarCampo(r.id, "nombre_completo", e.target.value)}
                      className="w-40 rounded-md border border-transparent hover:border-[var(--color-line)] focus:border-[var(--color-navy-700)] px-2 py-1 text-sm outline-none"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      defaultValue={r.ci ?? ""}
                      onBlur={(e) => actualizarCampo(r.id, "ci", e.target.value)}
                      className="w-24 rounded-md border border-transparent hover:border-[var(--color-line)] focus:border-[var(--color-navy-700)] px-2 py-1 text-sm outline-none"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      defaultValue={r.celular ?? ""}
                      onBlur={(e) => actualizarCampo(r.id, "celular", e.target.value)}
                      className="w-28 rounded-md border border-transparent hover:border-[var(--color-line)] focus:border-[var(--color-navy-700)] px-2 py-1 text-sm outline-none"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <select
                      value={r.monto}
                      onChange={(e) =>
                        actualizarCampo(r.id, "monto", Number(e.target.value))
                      }
                      className="w-20 rounded-md border border-transparent hover:border-[var(--color-line)] focus:border-[var(--color-navy-700)] px-2 py-1 text-sm outline-none"
                    >
                      {!MONTOS_PERMITIDOS.includes(r.monto as 10 | 20 | 30) && (
                        <option value={r.monto} disabled>
                          Inválido
                        </option>
                      )}
                      {MONTOS_PERMITIDOS.map((monto) => (
                        <option key={monto} value={monto}>
                          {monto}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <select
                      value={r.metodo_pago ?? ""}
                      onChange={(e) =>
                        actualizarCampo(
                          r.id,
                          "metodo_pago",
                          (e.target.value || null) as MetodoPago | null
                        )
                      }
                      className="rounded-md border border-[var(--color-line)] px-2 py-1 text-sm bg-white"
                    >
                      <option value="">—</option>
                      <option value="Efectivo">Efectivo</option>
                      <option value="QR">QR</option>
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <select
                      value={r.estado}
                      onChange={(e) =>
                        actualizarCampo(r.id, "estado", e.target.value as Estado)
                      }
                      className={`rounded-md px-2 py-1 text-xs font-medium border-0 ${
                        r.estado === "Cancelado"
                          ? "bg-[var(--color-ok-bg)] text-[var(--color-ok)]"
                          : "bg-[var(--color-pending-bg)] text-[var(--color-pending)]"
                      }`}
                    >
                      <option value="Pendiente">Pendiente</option>
                      <option value="Cancelado">Cancelado</option>
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <select
                      value={r.tipo_equipo ?? ""}
                      onChange={(e) =>
                        actualizarCampo(
                          r.id,
                          "tipo_equipo",
                          (e.target.value || null) as TipoEquipo | null
                        )
                      }
                      className="rounded-md border border-[var(--color-line)] px-2 py-1 text-sm bg-white"
                    >
                      <option value="">—</option>
                      <option value="Pc">Pc</option>
                      <option value="Laptop">Laptop</option>
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <input
                      defaultValue={r.observaciones ?? ""}
                      onBlur={(e) => actualizarCampo(r.id, "observaciones", e.target.value)}
                      className="w-40 rounded-md border border-transparent hover:border-[var(--color-line)] focus:border-[var(--color-navy-700)] px-2 py-1 text-sm outline-none"
                    />
                  </td>
                  <td className="px-2 py-1 text-right">
                    <button
                      onClick={() => borrarFila(r.id)}
                      className="text-[var(--color-ink-soft)] hover:text-[var(--color-pending)] text-xs"
                      title="Eliminar"
                    >
                      Borrar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {savingId && (
        <p className="text-xs text-[var(--color-ink-soft)] mt-2">Guardando…</p>
      )}
    </div>
  );
}
