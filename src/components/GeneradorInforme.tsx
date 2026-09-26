"use client";

import { useRef, useState } from "react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
} from "docx";

export interface FilaInforme {
  fecha: string;
  actividad: string;
  tipo: string;
  concepto: string;
  monto: number;
  metodo: string;
  responsable: string;
}

export interface PendienteInforme {
  descripcion: string;
  monto: number;
  actividad: string;
  responsable: string;
  estado: string;
  fecha: string;
}

export interface DetalleActividadInforme {
  actividad: string;
  ingresos: number;
  egresos: number;
}

export type TipoInformeCaja =
  | "general"
  | "actividad"
  | "ingresos-egresos"
  | "pendientes"
  | "responsable"
  | "rendicion";

interface GeneradorInformeProps {
  titulo: string;
  periodo: string;
  tipo: TipoInformeCaja;
  ingresos: FilaInforme[];
  egresos: FilaInforme[];
  pendientes: PendienteInforme[];
  detalleActividad: DetalleActividadInforme[];
  responsableControl?: string;
  fondosAnteriores?: number;
  saldoCaja?: number;
  saldoNeto?: number;
  botonLabel: string;
}

function nombreArchivo(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function moneda(valor: number) {
  return `${Number(valor || 0).toFixed(2)} Bs`;
}

function tablaWord(encabezados: string[], filas: string[][]) {
  return new Table({
    rows: [
      new TableRow({
        children: encabezados.map((encabezado) =>
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: encabezado, bold: true })] })] })
        ),
      }),
      ...filas.map((fila) =>
        new TableRow({
          children: fila.map((valor) => new TableCell({ children: [new Paragraph(valor)] })),
        })
      ),
    ],
  });
}

export default function GeneradorInforme({
  titulo,
  periodo,
  tipo,
  ingresos,
  egresos,
  pendientes,
  detalleActividad,
  responsableControl = "",
  fondosAnteriores = 0,
  saldoCaja,
  saldoNeto,
  botonLabel,
}: GeneradorInformeProps) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const periodoAnual = /^Año\s+(\d{4})$/.exec(periodo);
  const nombreBase = `informe-caja-${nombreArchivo(tipo)}-${periodoAnual ? `anual-${periodoAnual[1]}` : nombreArchivo(periodo)}`;
  const totalIngresos = ingresos.reduce((total, fila) => total + Number(fila.monto || 0), 0);
  const totalEgresos = egresos.reduce((total, fila) => total + Number(fila.monto || 0), 0);
  const totalAdministrado = fondosAnteriores + totalIngresos;
  const saldoCalculado = saldoCaja ?? totalAdministrado - totalEgresos;
  const pendientesTotal = pendientes.reduce((total, pendiente) => total + Number(pendiente.monto || 0), 0);
  const saldoNetoCalculado = saldoNeto ?? saldoCalculado - pendientesTotal;

  async function exportarPDF() {
    if (!contenedorRef.current) return;
    const canvas = await html2canvas(contenedorRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });
    const pdf = new jsPDF("l", "pt", "a4");
    const margin = 24;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const anchoDisponible = pageWidth - margin * 2;
    const altoDisponible = pageHeight - margin * 2;
    const escala = anchoDisponible / canvas.width;
    const altoTramo = Math.floor(altoDisponible / escala);

    for (let y = 0; y < canvas.height; y += altoTramo) {
      if (y > 0) pdf.addPage();
      const altoRecorte = Math.min(altoTramo, canvas.height - y);
      const recorte = document.createElement("canvas");
      recorte.width = canvas.width;
      recorte.height = altoRecorte;
      const contexto = recorte.getContext("2d");
      if (!contexto) return;
      contexto.drawImage(canvas, 0, y, canvas.width, altoRecorte, 0, 0, recorte.width, recorte.height);
      pdf.addImage(recorte.toDataURL("image/png"), "PNG", margin, margin, anchoDisponible, altoRecorte * escala, undefined, "FAST");
    }
    pdf.save(`${nombreBase}.pdf`);
  }

  function exportarExcel() {
    const encabezadosMovimientos = ["Fecha", "Actividad", "Concepto", "Monto", "Método", "Responsable"];
    const filaMovimiento = (fila: FilaInforme) => [fila.fecha, fila.actividad, fila.concepto, fila.monto, fila.metodo, fila.responsable];
    const filas = [
      [titulo],
      [`Responsable de control: ${responsableControl || "____________________________"}`],
      [`Periodo: ${periodo}`],
      [],
      ["Tabla de ingresos"],
      encabezadosMovimientos,
      ...ingresos.map(filaMovimiento),
      [],
      ["Tabla de egresos"],
      encabezadosMovimientos,
      ...egresos.map(filaMovimiento),
      [],
      ["Resumen de caja"],
      ["Fondos anteriores", fondosAnteriores],
      ["Total administrado", totalAdministrado],
      ["Saldo de caja", saldoCalculado],
      ["Pendientes", pendientesTotal],
      ["Detalle de pendientes"],
      ["Descripción", "Monto", "Actividad", "Responsable", "Estado"],
      ...pendientes.map((pendiente) => [pendiente.descripcion, pendiente.monto, pendiente.actividad, pendiente.responsable, pendiente.estado]),
      [],
      ["Saldo neto", saldoNetoCalculado],
      [],
      ["Detalle por actividad"],
      ["Actividad", "Ingresos", "Egresos", "Neto"],
      ...detalleActividad.map((detalle) => [detalle.actividad, detalle.ingresos, detalle.egresos, detalle.ingresos - detalle.egresos]),
      [],
      ["Firma del responsable", "____________________________"],
    ];
    const hoja = XLSX.utils.aoa_to_sheet(filas);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Informe");
    XLSX.writeFile(libro, `${nombreBase}.xlsx`);
  }

  async function exportarWord() {
    const ingresosFilas = ingresos.map((fila) => [fila.fecha, fila.actividad, fila.concepto, moneda(fila.monto), fila.responsable]);
    const egresosFilas = egresos.map((fila) => [fila.fecha, fila.actividad, fila.concepto, moneda(fila.monto), fila.responsable]);
    const pendientesFilas = pendientes.map((pendiente) => [pendiente.descripcion, moneda(pendiente.monto), pendiente.actividad, pendiente.responsable, pendiente.estado]);
    const actividadFilas = detalleActividad.map((detalle) => [detalle.actividad, moneda(detalle.ingresos), moneda(detalle.egresos), moneda(detalle.ingresos - detalle.egresos)]);

    const documento = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({ text: titulo, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
          new Paragraph({ children: [new TextRun({ text: `Responsable de control: ${responsableControl || "____________________________"}`, bold: true })] }),
          new Paragraph(`Periodo: ${periodo}`),
          new Paragraph({ text: "Tabla de ingresos", heading: HeadingLevel.HEADING_2 }),
          tablaWord(["Fecha", "Actividad", "Concepto", "Monto", "Responsable"], ingresosFilas),
          new Paragraph({ text: "Tabla de egresos", heading: HeadingLevel.HEADING_2 }),
          tablaWord(["Fecha", "Actividad", "Concepto", "Monto", "Responsable"], egresosFilas),
          new Paragraph({ text: "Resumen de caja", heading: HeadingLevel.HEADING_2 }),
          new Paragraph(`Fondos anteriores: ${moneda(fondosAnteriores)}`),
          new Paragraph(`Total administrado: ${moneda(totalAdministrado)}`),
          new Paragraph(`Saldo de caja: ${moneda(saldoCalculado)}`),
          new Paragraph(`Pendientes: ${moneda(pendientesTotal)}`),
          new Paragraph({ text: "Detalle de pendientes", heading: HeadingLevel.HEADING_2 }),
          tablaWord(["Descripción", "Monto", "Actividad", "Responsable", "Estado"], pendientesFilas),
          new Paragraph(`Saldo neto: ${moneda(saldoNetoCalculado)}`),
          new Paragraph({ text: "Detalle por actividad", heading: HeadingLevel.HEADING_2 }),
          tablaWord(["Actividad", "Ingresos", "Egresos", "Neto"], actividadFilas),
          new Paragraph("\n\nFirma del responsable: ________________________________________________"),
        ],
      }],
    });
    const blob = await Packer.toBlob(documento);
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = `${nombreBase}.docx`;
    enlace.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
    <div className="rounded-lg border border-[var(--color-line)] bg-white p-3">
      <div className="no-print relative">
        <button
          type="button"
          onClick={() => setMenuAbierto((abierto) => !abierto)}
          aria-haspopup="menu"
          aria-expanded={menuAbierto}
          className="w-full rounded-lg bg-[var(--color-navy-800)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--color-navy-900)]"
        >
          {botonLabel}
        </button>
        {menuAbierto && (
          <div role="menu" className="absolute left-0 right-0 z-20 mt-2 rounded-lg border border-[var(--color-line)] bg-white p-1 shadow-lg">
            <button
              type="button"
              role="menuitem"
              onClick={() => { setMenuAbierto(false); void exportarPDF(); }}
              className="block w-full rounded-md px-3 py-2 text-left text-sm text-[var(--color-ink)] hover:bg-[var(--color-navy-50)]"
            >
              PDF
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => { setMenuAbierto(false); exportarExcel(); }}
              className="block w-full rounded-md px-3 py-2 text-left text-sm text-[var(--color-ink)] hover:bg-[var(--color-navy-50)]"
            >
              Excel
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => { setMenuAbierto(false); void exportarWord(); }}
              className="block w-full rounded-md px-3 py-2 text-left text-sm text-[var(--color-ink)] hover:bg-[var(--color-navy-50)]"
            >
              Word
            </button>
          </div>
        )}
      </div>
    </div>
    <div ref={contenedorRef} className="fixed left-[-12000px] top-0 w-[1100px] bg-white p-8 text-black" aria-hidden="true">
      <h1 className="mb-2 text-2xl font-bold">{titulo}</h1>
      <p>Responsable de control: {responsableControl || "____________________________"}</p>
      <p className="mb-6">Periodo: {periodo}</p>
      <h2 className="mb-2 text-lg font-bold">Tabla de ingresos</h2>
      <table className="mb-6 w-full border-collapse text-sm">
        <thead><tr>{["Fecha", "Actividad", "Concepto", "Monto", "Responsable"].map((texto) => <th key={texto} className="border p-2 text-left">{texto}</th>)}</tr></thead>
        <tbody>{ingresos.map((fila, indice) => <tr key={`${fila.fecha}-${indice}`}><td className="border p-2">{fila.fecha}</td><td className="border p-2">{fila.actividad}</td><td className="border p-2">{fila.concepto}</td><td className="border p-2">{moneda(fila.monto)}</td><td className="border p-2">{fila.responsable}</td></tr>)}</tbody>
      </table>
      <h2 className="mb-2 text-lg font-bold">Tabla de egresos</h2>
      <table className="mb-6 w-full border-collapse text-sm">
        <thead><tr>{["Fecha", "Actividad", "Concepto", "Monto", "Responsable"].map((texto) => <th key={texto} className="border p-2 text-left">{texto}</th>)}</tr></thead>
        <tbody>{egresos.map((fila, indice) => <tr key={`${fila.fecha}-${indice}`}><td className="border p-2">{fila.fecha}</td><td className="border p-2">{fila.actividad}</td><td className="border p-2">{fila.concepto}</td><td className="border p-2">{moneda(fila.monto)}</td><td className="border p-2">{fila.responsable}</td></tr>)}</tbody>
      </table>
      <h2 className="mb-2 text-lg font-bold">Resumen de caja</h2>
      <p>Fondos anteriores: {moneda(fondosAnteriores)}</p>
      <p>Total administrado: {moneda(totalAdministrado)}</p>
      <p>Saldo de caja: {moneda(saldoCalculado)}</p>
      <p>Pendientes: {moneda(pendientesTotal)}</p>
      <h2 className="mb-2 text-lg font-bold">Detalle de pendientes</h2>
      <table className="mb-6 w-full border-collapse text-sm">
        <thead><tr>{["Descripción", "Monto", "Actividad", "Responsable", "Estado"].map((texto) => <th key={texto} className="border p-2 text-left">{texto}</th>)}</tr></thead>
        <tbody>{pendientes.map((pendiente, indice) => <tr key={`${pendiente.descripcion}-${indice}`}><td className="border p-2">{pendiente.descripcion}</td><td className="border p-2">{moneda(pendiente.monto)}</td><td className="border p-2">{pendiente.actividad}</td><td className="border p-2">{pendiente.responsable}</td><td className="border p-2">{pendiente.estado}</td></tr>)}</tbody>
      </table>
      <p className="mb-6">Saldo neto: {moneda(saldoNetoCalculado)}</p>
      <h2 className="mb-2 text-lg font-bold">Detalle por actividad</h2>
      <table className="mb-6 w-full border-collapse text-sm">
        <thead><tr>{["Actividad", "Ingresos", "Egresos", "Neto"].map((texto) => <th key={texto} className="border p-2 text-left">{texto}</th>)}</tr></thead>
        <tbody>{detalleActividad.map((detalle, indice) => <tr key={`${detalle.actividad}-${indice}`}><td className="border p-2">{detalle.actividad}</td><td className="border p-2">{moneda(detalle.ingresos)}</td><td className="border p-2">{moneda(detalle.egresos)}</td><td className="border p-2">{moneda(detalle.ingresos - detalle.egresos)}</td></tr>)}</tbody>
      </table>
      <p className="mt-8">Firma del responsable: ________________________________________________</p>
      </div>
    </>
  );
}
