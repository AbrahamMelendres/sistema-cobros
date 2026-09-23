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

function filasExcel(filas: FilaInforme[]) {
  return filas.map((fila) => ({
    Fecha: fila.fecha,
    Actividad: fila.actividad,
    Tipo: fila.tipo,
    Concepto: fila.concepto,
    Monto: fila.monto,
    Método: fila.metodo,
    Responsable: fila.responsable,
  }));
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
  const nombreBase = `informe-caja-${nombreArchivo(tipo)}-${nombreArchivo(periodo)}`;
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
    const imageWidth = pageWidth - margin * 2;
    const imageHeight = (canvas.height * imageWidth) / canvas.width;
    const height = Math.min(imageHeight, pageHeight - margin * 2);
    const width = (canvas.width * height) / canvas.height;
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin, margin, width, height, undefined, "FAST");
    pdf.save(`${nombreBase}.pdf`);
  }

  function exportarExcel() {
    const hoja = XLSX.utils.json_to_sheet(filasExcel([...ingresos, ...egresos]), {
      header: ["Fecha", "Actividad", "Tipo", "Concepto", "Monto", "Método", "Responsable"],
    });
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Movimientos");
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
          new Paragraph(`Saldo neto: ${moneda(saldoNetoCalculado)}`),
          new Paragraph({ text: "Detalle por actividad", heading: HeadingLevel.HEADING_2 }),
          tablaWord(["Actividad", "Ingresos", "Egresos", "Neto"], actividadFilas),
          new Paragraph({ text: "Pendientes", heading: HeadingLevel.HEADING_2 }),
          tablaWord(["Descripción", "Monto", "Actividad", "Responsable", "Estado"], pendientesFilas),
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
    <div ref={contenedorRef} className="rounded-lg border border-[var(--color-line)] bg-white p-3">
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
      <div className="sr-only" aria-hidden="true">
        <h2>{titulo}</h2>
        <p>{periodo}</p>
        <p>Total administrado: {moneda(totalAdministrado)}</p>
      </div>
    </div>
  );
}
