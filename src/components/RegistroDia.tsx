"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Registro,
  Estado,
  EstadoPago,
  MetodoPago,
  Servicio,
  TipoEquipo,
  EquipoRegistro,
  RegistroInput,
} from "@/lib/types";
import * as XLSX from "xlsx";

const SERVICIOS: Servicio[] = ["Mantenimiento", "Formateo", "Optimizacion", "Otros"];
const COLUMNAS_EXCEL = [
  "Fecha", "N°", "Nombre completo", "CI", "Celular", "Cantidad de equipos", "Servicios", "Monto (Bs)",
  "Método", "Estado de pago", "Observaciones",
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

function normalizarEncabezado(valor: unknown) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function valorDeFila(fila: Record<string, unknown>, nombres: string[]) {
  const entradas = Object.entries(fila);
  const entrada = entradas.find(([encabezado]) =>
    nombres.includes(normalizarEncabezado(encabezado))
  );
  return entrada?.[1];
}

function fechaDeExcel(valor: unknown, fechaPorDefecto: string) {
  if (typeof valor === "number") {
    const fecha = XLSX.SSF.parse_date_code(valor);
    if (fecha) {
      return `${fecha.y.toString().padStart(4, "0")}-${fecha.m.toString().padStart(2, "0")}-${fecha.d.toString().padStart(2, "0")}`;
    }
  }
  const texto = String(valor ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
  return fechaPorDefecto;
}

function normalizarOpcion(valor: unknown) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function textoDeFila(valor: unknown) {
  return String(valor ?? "").trim();
}

function equiposDelRegistro(registro: Registro): EquipoRegistro[] {
  if (registro.equipos?.length) {
    return registro.equipos.map((equipo) => ({
      tipo_equipo: equipo.tipo_equipo ?? null,
      servicios: equipo.servicios ?? [],
      descripcion: equipo.descripcion ?? "",
    }));
  }
  return [{
    tipo_equipo: registro.tipo_equipo,
    servicios: registro.servicios ?? [],
    descripcion: registro.observaciones ?? "",
  }];
}

function calcularMontoEquipos(equipos: EquipoRegistro[]) {
  return equipos.reduce((total, equipo) => total + equipo.servicios.length * 10, 0) || 10;
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
  const [vistaPrevia, setVistaPrevia] = useState<RegistroInput[] | null>(null);
  const [busqueda, setBusqueda] = useState("");

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
    setBusqueda("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha]);

  const registrosFiltrados = useMemo(() => {
    const termino = normalizarOpcion(busqueda);
    if (!termino) return registros;

    return registros.filter((registro) => {
      const contenido = [
        registro.numero,
        registro.nombre_completo,
        registro.ci,
        registro.celular,
        equiposDelRegistro(registro).flatMap((equipo) => [
          equipo.tipo_equipo,
          equipo.servicios.join(" "),
        ]),
        registro.monto,
        registro.metodo_pago,
        registro.estado_pago,
        registro.tipo_equipo,
        registro.observaciones,
      ]
        .map((valor) => normalizarOpcion(valor))
        .join(" ");

      return contenido.includes(termino);
    });
  }, [busqueda, registros]);

  async function actualizarCampo(
    id: string,
    campo: keyof Registro,
    valor: string | number | string[] | null
  ) {
    setRegistros((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [campo]: valor } : r))
    );
    setSavingId(id);
    const { error } = await supabase
      .from("registros")
      .update({ [campo]: valor })
      .eq("id", id);
    setSavingId(null);
    if (error) {
      setMensajeExcel(`No se pudo guardar el cambio: ${error.message}`);
      await cargarRegistros(fecha);
    }
  }

  async function actualizarEquipos(id: string, equipos: EquipoRegistro[]) {
    const registro = registros.find((item) => item.id === id);
    if (!registro) return;
    const monto = calcularMontoEquipos(equipos);
    const primerEquipo = equipos[0];
    setRegistros((prev) =>
      prev.map((r) => (r.id === id
        ? {
            ...r,
            equipos,
            cantidad_equipos: equipos.length,
            tipo_equipo: primerEquipo?.tipo_equipo ?? null,
            servicios: primerEquipo?.servicios ?? [],
            monto,
          }
        : r))
    );
    setSavingId(id);
    const { error } = await supabase
      .from("registros")
      .update({
        equipos,
        cantidad_equipos: equipos.length,
        tipo_equipo: primerEquipo?.tipo_equipo ?? null,
        servicios: primerEquipo?.servicios ?? [],
        monto,
      })
      .eq("id", id);
    setSavingId(null);
    if (error) {
      setMensajeExcel(`No se pudo guardar el equipo: ${error.message}`);
      await cargarRegistros(fecha);
    }
  }

  async function actualizarCantidadEquipos(id: string, valor: number) {
    const cantidadEquipos = Math.max(1, Math.floor(valor) || 1);
    const registro = registros.find((item) => item.id === id);
    if (!registro) return;
    const equiposActuales = equiposDelRegistro(registro);
    const equipos = Array.from({ length: cantidadEquipos }, (_, indice) =>
      equiposActuales[indice] ?? { tipo_equipo: null, servicios: [], descripcion: "" }
    );
    await actualizarEquipos(id, equipos);
  }

  async function actualizarEquipo(id: string, indice: number, cambios: Partial<EquipoRegistro>) {
    const registro = registros.find((item) => item.id === id);
    if (!registro) return;
    const equipos = equiposDelRegistro(registro).map((equipo, equipoIndice) =>
      equipoIndice === indice ? { ...equipo, ...cambios } : equipo
    );
    await actualizarEquipos(id, equipos);
  }

  async function actualizarPago(id: string, estadoPago: EstadoPago) {
    const estado = estadoPago === "Pagado" ? "Cancelado" : "Pendiente";
    setRegistros((prev) =>
      prev.map((r) => (r.id === id ? { ...r, estado_pago: estadoPago, estado } : r))
    );
    setSavingId(id);
    const { error } = await supabase.from("registros").update({ estado_pago: estadoPago, estado }).eq("id", id);
    setSavingId(null);
    if (error) {
      setMensajeExcel(`No se pudo actualizar el pago: ${error.message}`);
      await cargarRegistros(fecha);
    }
  }

  async function agregarFila() {
    const siguienteNumero =
      registros.reduce((max, r) => Math.max(max, r.numero ?? 0), 0) + 1;

    const { data, error } = await supabase
      .from("registros")
      .insert({
        fecha,
        numero: siguienteNumero,
        cantidad_equipos: 1,
        equipos: [{ tipo_equipo: null, servicios: [], descripcion: "" }],
        monto: 10,
        estado: "Pendiente" as Estado,
        estado_pago: "Pendiente" as EstadoPago,
        servicios: [],
        encargada: nombreEncargada || null,
      })
      .select()
      .single();

    if (error) {
      setMensajeExcel(`No se pudo agregar el registro: ${error.message}`);
      return;
    }

    if (data) {
      setRegistros((prev) => [...prev, data as Registro]);
      if (!fechasConDatos.includes(fecha)) {
        setFechasConDatos((prev) => [fecha, ...prev]);
      }
    }
  }

  async function borrarFila(id: string) {
    if (!confirm("¿Eliminar este registro?")) return;
    setRegistros((prev) => prev.filter((r) => r.id !== id));
    const { error } = await supabase.from("registros").delete().eq("id", id);
    if (error) {
      setMensajeExcel(`No se pudo eliminar el registro: ${error.message}`);
      await cargarRegistros(fecha);
    }
  }

  function exportarExcel() {
    const filas = registros.map((registro) => {
      const equipos = equiposDelRegistro(registro);
      return {
        Fecha: registro.fecha,
        "N°": registro.numero,
        "Nombre completo": registro.nombre_completo ?? "",
        CI: registro.ci ?? "",
        Celular: registro.celular ?? "",
        "Cantidad de equipos": equipos.length,
        Servicios: equipos.map((equipo, indice) => `Equipo ${indice + 1}: ${equipo.servicios.join(", ") || "Sin seleccionar"}`).join(" | "),
        "Monto (Bs)": registro.monto,
        Método: registro.metodo_pago ?? "",
        "Estado de pago": registro.estado_pago ?? (registro.estado === "Cancelado" ? "Pagado" : "Pendiente"),
        Observaciones: equipos.map((equipo, indice) => `Equipo ${indice + 1}: ${equipo.descripcion || "Sin descripción"}`).join(" | "),
      };
    });
    const hoja = XLSX.utils.json_to_sheet(filas, { header: COLUMNAS_EXCEL });
    hoja["!cols"] = [
      { wch: 12 }, { wch: 6 }, { wch: 28 }, { wch: 14 }, { wch: 16 },
      { wch: 20 }, { wch: 28 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 12 }, { wch: 32 },
    ];
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Registros");
    XLSX.writeFile(libro, `registros-${fecha}.xlsx`);
    setMensajeExcel(`${registros.length} registro(s) exportado(s).`);
  }

  function descargarPlantilla() {
    const filas = [{
      Fecha: fecha,
      "N°": 1,
      "Nombre completo": "Ejemplo Cliente",
      CI: "1234567",
      Celular: "70000000",
      "Cantidad de equipos": 1,
      Servicios: "Mantenimiento, Formateo",
      "Monto (Bs)": 20,
      Método: "Efectivo",
      "Estado de pago": "Pendiente",
      Observaciones: "",
    }];
    const hoja = XLSX.utils.json_to_sheet(filas, { header: COLUMNAS_EXCEL });
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Registros");
    XLSX.writeFile(libro, "plantilla-registros.xlsx");
  }

  async function confirmarImportacion() {
    if (!vistaPrevia) return;
    setImportando(true);
    const { data, error } = await supabase.from("registros").insert(vistaPrevia).select();
    if (error) {
      setMensajeExcel(`No se importó: ${error.message}`);
    } else if (data) {
      await cargarFechas();
      await cargarRegistros(fecha);
      setMensajeExcel(`${data.length} registro(s) importado(s) correctamente.`);
      setVistaPrevia(null);
    }
    setImportando(false);
  }

  async function importarExcel(event: React.ChangeEvent<HTMLInputElement>) {
    const archivo = event.target.files?.[0];
    event.target.value = "";
    if (!archivo) return;

    setImportando(true);
    setMensajeExcel(null);
    setVistaPrevia(null);
    try {
      const libro = XLSX.read(await archivo.arrayBuffer(), { type: "array" });
      const hoja = libro.SheetNames
        .map((nombre) => libro.Sheets[nombre])
        .sort((a, b) => XLSX.utils.decode_range(b["!ref"] ?? "A1").e.r - XLSX.utils.decode_range(a["!ref"] ?? "A1").e.r)[0];
      const datos = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { defval: "" });
      if (datos.length === 0) throw new Error("no se encontraron filas con datos en el archivo");
      const registrosParaInsertar: RegistroInput[] = datos.map((fila, indice) => {
        const fechaFila = fechaDeExcel(valorDeFila(fila, ["fecha", "dia"]), fecha);
        const nombre = textoDeFila(valorDeFila(fila, ["nombrecompleto", "nombre", "nombrecliente", "nombredelcliente", "cliente"]));
        const ci = textoDeFila(valorDeFila(fila, ["ci", "carnet", "carnetdeidentidad", "cedula", "documento"]));
        const celular = textoDeFila(valorDeFila(fila, ["celular", "ndecelular", "numerodecelular", "telefonocelular", "telefono", "movil", "contacto"]));
        const metodoTexto = textoDeFila(valorDeFila(fila, ["metodo", "metododepago", "metodopago", "formadepago", "pago"]));
        const equipoTexto = textoDeFila(valorDeFila(fila, ["equipo", "tipodeequipo", "tipoequipo", "dispositivo"]));
        const cantidadEquipos = Math.max(1, Math.floor(Number(valorDeFila(fila, ["cantidaddeequipos", "cantidad", "equipos", "numerodeequipos"])) || 1));
        const servicioTexto = textoDeFila(valorDeFila(fila, ["servicio", "servicios", "tiposervicio", "trabajo"]));
        const servicios = servicioTexto.split(/[,;/+]|\s+y\s+/i).map((valor) => valor.trim()).filter(Boolean);
        const serviciosNormalizados = servicios.map((valor) => {
          const opcion = normalizarOpcion(valor);
          if (opcion === "mantenimiento") return "Mantenimiento";
          if (opcion === "formateo") return "Formateo";
          if (opcion === "optimizacion") return "Optimizacion";
          if (opcion === "otros" || opcion === "otro") return "Otros";
          throw new Error(`fila ${indice + 2}: servicio inválido`);
        }) as Servicio[];
        const montoTexto = String(valorDeFila(fila, ["montobs", "monto", "importe", "precio"]) || "10")
          .replace(/bs/gi, "")
          .replace(/\s/g, "")
          .replace(",", ".");
        const montoExcel = Number(montoTexto);
        const monto = serviciosNormalizados.length > 0 ? serviciosNormalizados.length * cantidadEquipos * 10 : montoExcel;
        const estadoTexto = normalizarOpcion(valorDeFila(fila, ["estadodepago", "pagodelservicio", "estadopago", "estado", "situacion"]));
        const estadoPago: EstadoPago = estadoTexto === "pagado" || estadoTexto === "cancelado" ? "Pagado" : "Pendiente";
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaFila)) throw new Error(`fila ${indice + 2}: fecha inválida`);
        if (!Number.isFinite(monto) || monto <= 0) throw new Error(`fila ${indice + 2}: monto inválido`);
        if (metodoTexto && !["efectivo", "qr"].includes(normalizarOpcion(metodoTexto))) throw new Error(`fila ${indice + 2}: método inválido`);
        if (equipoTexto && !["pc", "laptop"].includes(normalizarOpcion(equipoTexto))) throw new Error(`fila ${indice + 2}: equipo inválido`);
        return {
          fecha: fechaFila,
          numero: Number(valorDeFila(fila, ["n", "numero", "no"]) || indice + 1) || indice + 1,
          nombre_completo: nombre || null,
          ci: ci || null,
          celular: celular || null,
          cantidad_equipos: cantidadEquipos,
          equipos: [{
            tipo_equipo: (equipoTexto ? (normalizarOpcion(equipoTexto) === "laptop" ? "Laptop" : "Pc") : null) as TipoEquipo | null,
            servicios: serviciosNormalizados,
            descripcion: textoDeFila(valorDeFila(fila, ["descripcion", "descripcionequipo", "detalle", "observaciones", "observacion"])) || "",
          }],
          monto,
          metodo_pago: (metodoTexto ? (normalizarOpcion(metodoTexto) === "qr" ? "QR" : "Efectivo") : null) as MetodoPago | null,
          estado: estadoPago === "Pagado" ? "Cancelado" : "Pendiente",
          servicios: serviciosNormalizados,
          estado_pago: estadoPago,
          tipo_equipo: (equipoTexto ? (normalizarOpcion(equipoTexto) === "laptop" ? "Laptop" : "Pc") : null) as TipoEquipo | null,
          observaciones: textoDeFila(valorDeFila(fila, ["observaciones", "observacion", "comentarios", "comentario"])) || null,
          encargada: nombreEncargada || null,
        };
      });
      if (registrosParaInsertar.length === 0) throw new Error("el archivo está vacío");
      setVistaPrevia(registrosParaInsertar);
      setMensajeExcel(`${registrosParaInsertar.length} fila(s) detectada(s). Revisa y confirma la importación.`);
    } catch (error) {
      setMensajeExcel(error instanceof Error ? `No se importó: ${error.message}` : "No se pudo leer el archivo.");
    } finally {
      setImportando(false);
    }
  }

  const cabecera = [
    "N°",
    "Nombre completo",
    "CI",
    "Celular",
    "Cantidad",
    "Equipos y servicios",
    "Monto (Bs)",
    "Método",
    "Estado de pago",
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
            onClick={descargarPlantilla}
            className="rounded-lg border border-[var(--color-line)] bg-white px-3 py-2 text-sm font-medium hover:bg-[var(--color-navy-50)]"
          >
            Descargar plantilla
          </button>
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

      {vistaPrevia && (
        <div className="mb-6 rounded-xl border border-[var(--color-navy-100)] bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold">Vista previa de importación</h2>
              <p className="text-xs text-[var(--color-ink-soft)]">
                {vistaPrevia.length} fila(s) validadas. Confirma solo cuando los datos sean correctos.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setVistaPrevia(null)}
                disabled={importando}
                className="rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm font-medium hover:bg-[var(--color-navy-50)]"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarImportacion}
                disabled={importando}
                className="rounded-lg bg-[var(--color-navy-800)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--color-navy-900)] disabled:opacity-50"
              >
                {importando ? "Guardando…" : "Confirmar importación"}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-xs">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-left text-[var(--color-ink-soft)]">
                  <th className="px-2 py-2">Fila</th>
                  <th className="px-2 py-2">Cliente</th>
                  <th className="px-2 py-2">CI</th>
                  <th className="px-2 py-2">Celular</th>
                  <th className="px-2 py-2">Servicios</th>
                  <th className="px-2 py-2">Monto</th>
                  <th className="px-2 py-2">Pago</th>
                </tr>
              </thead>
              <tbody>
                {vistaPrevia.slice(0, 10).map((registro, indice) => (
                  <tr key={`${registro.numero}-${indice}`} className="border-b border-[var(--color-line)] last:border-0">
                    <td className="px-2 py-2">{indice + 2}</td>
                    <td className="px-2 py-2">{registro.nombre_completo || "(vacío)"}</td>
                    <td className="px-2 py-2">{registro.ci || "(vacío)"}</td>
                    <td className="px-2 py-2">{registro.celular || "(vacío)"}</td>
                    <td className="px-2 py-2">{registro.servicios.join(", ") || "(vacío)"}</td>
                    <td className="px-2 py-2 font-semibold">{registro.monto} Bs</td>
                    <td className="px-2 py-2">{registro.estado_pago}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {vistaPrevia.length > 10 && (
            <p className="mt-2 text-xs text-[var(--color-ink-soft)]">Mostrando las primeras 10 filas.</p>
          )}
        </div>
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

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex min-w-[min(100%,20rem)] flex-1 items-center gap-2 rounded-lg border border-[var(--color-line)] bg-white px-3 py-2 focus-within:border-[var(--color-navy-700)]">
          <span className="text-[var(--color-ink-soft)]" aria-hidden="true">⌕</span>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, CI, celular o servicio"
            aria-label="Buscar registros"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-ink-soft)]"
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda("")}
              className="text-xs text-[var(--color-ink-soft)] hover:text-[var(--color-navy-900)]"
              aria-label="Limpiar búsqueda"
              title="Limpiar búsqueda"
            >
              Limpiar
            </button>
          )}
        </label>
        <span className="text-xs text-[var(--color-ink-soft)]">
          {busqueda ? `${registrosFiltrados.length} de ${registros.length} registro(s)` : `${registros.length} registro(s)`}
        </span>
      </div>

      <div className="bg-white rounded-xl border border-[var(--color-line)] overflow-hidden">
        <div className="max-h-[calc(100vh-16rem)] min-h-[18rem] overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="sticky top-0 z-10 border-b border-[var(--color-line)] bg-[var(--color-navy-50)]">
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
                  <td colSpan={11} className="px-3 py-8 text-center text-[var(--color-ink-soft)]">
                    Cargando…
                  </td>
                </tr>
              )}
              {!loading && registros.length === 0 && (
                <tr>
                    <td colSpan={11} className="px-3 py-8 text-center text-[var(--color-ink-soft)]">
                    Todavía no hay registros para este día. Usa &ldquo;Agregar registro&rdquo;.
                  </td>
                </tr>
              )}
              {!loading && registros.length > 0 && registrosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center text-[var(--color-ink-soft)]">
                    No se encontraron registros con &ldquo;{busqueda}&rdquo;.
                  </td>
                </tr>
              )}
              {registrosFiltrados.map((r) => (
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
                    <input
                      type="number"
                      min="1"
                      step="1"
                      defaultValue={r.cantidad_equipos ?? 1}
                      onBlur={(e) => actualizarCantidadEquipos(r.id, Number(e.target.value))}
                      className="w-16 rounded-md border border-[var(--color-line)] px-2 py-1 text-sm outline-none focus:border-[var(--color-navy-700)]"
                      aria-label={`Cantidad de equipos de ${r.nombre_completo || "este registro"}`}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <div className="grid grid-cols-1 min-[1200px]:grid-cols-2 gap-2 min-w-64">
                      {equiposDelRegistro(r).map((equipo, indice) => (
                        <div key={indice} className="rounded-lg border border-[var(--color-line)] bg-white px-2.5 py-2">
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
                              Equipo {indice + 1}
                            </span>
                            <select
                              value={equipo.tipo_equipo ?? ""}
                              onChange={(e) => actualizarEquipo(r.id, indice, {
                                tipo_equipo: (e.target.value || null) as TipoEquipo | null,
                              })}
                              className="rounded-md border border-[var(--color-line)] px-2 py-1 text-xs bg-white"
                              aria-label={`Tipo del equipo ${indice + 1}`}
                            >
                              <option value="">Tipo</option>
                              <option value="Pc">Pc</option>
                              <option value="Laptop">Laptop</option>
                            </select>
                          </div>
                          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-1">
                            {SERVICIOS.map((servicio) => {
                              const seleccionado = equipo.servicios.includes(servicio);
                              return (
                                <label
                                  key={servicio}
                                  className={`flex min-w-0 cursor-pointer items-center gap-1 rounded-md px-1 py-1 text-xs transition-colors ${
                                    seleccionado
                                      ? "bg-[var(--color-navy-50)] text-[var(--color-navy-900)]"
                                      : "text-[var(--color-ink-soft)] hover:bg-[var(--color-navy-50)]"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={seleccionado}
                                    onChange={() => {
                                      const servicios = seleccionado
                                        ? equipo.servicios.filter((item) => item !== servicio)
                                        : [...equipo.servicios, servicio];
                                      actualizarEquipo(r.id, indice, { servicios });
                                    }}
                                    className="h-3.5 w-3.5 shrink-0 accent-[var(--color-navy-800)]"
                                  />
                                  <span className="min-w-0 break-words">{servicio}</span>
                                </label>
                              );
                            })}
                          </div>
                          <input
                            type="text"
                            defaultValue={equipo.descripcion}
                            onBlur={(e) => actualizarEquipo(r.id, indice, { descripcion: e.target.value })}
                            placeholder="Descripción del equipo"
                            aria-label={`Descripción del equipo ${indice + 1}`}
                            className="mt-2 w-full rounded-md border border-[var(--color-line)] px-2 py-1.5 text-xs outline-none focus:border-[var(--color-navy-700)]"
                          />
                        </div>
                      ))}
                    </div>
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
                    <span className="inline-flex min-w-16 justify-center rounded-md bg-[var(--color-navy-50)] px-2 py-1 text-sm font-semibold text-[var(--color-navy-900)]">
                      {r.monto} Bs
                    </span>
                  </td>
                  <td className="px-2 py-1">
                    <select
                      value={r.estado_pago ?? (r.estado === "Cancelado" ? "Pagado" : "Pendiente")}
                      onChange={(e) =>
                        actualizarPago(r.id, e.target.value as EstadoPago)
                      }
                      className={`rounded-md px-2 py-1 text-xs font-medium border-0 ${
                        (r.estado_pago ?? (r.estado === "Cancelado" ? "Pagado" : "Pendiente")) === "Pagado"
                          ? "bg-[var(--color-ok-bg)] text-[var(--color-ok)]"
                          : "bg-[var(--color-pending-bg)] text-[var(--color-pending)]"
                      }`}
                    >
                      <option value="Pendiente">Pendiente</option>
                      <option value="Pagado">Pagado</option>
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
