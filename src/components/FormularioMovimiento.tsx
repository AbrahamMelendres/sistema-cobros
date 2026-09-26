"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import SelectConCrear from "@/components/SelectConCrear";

type TipoMovimiento = "Ingreso" | "Egreso";
type MetodoPago = "Efectivo" | "QR";

interface OpcionCatalogo {
  id: string;
  nombre: string;
}

interface MovimientoFormulario {
  actividad_id: string;
  tipo: TipoMovimiento;
  concepto: string;
  monto: string;
  metodo_pago: MetodoPago | "";
  responsable_id: string;
  persona_relacionada: string;
  observaciones: string;
}

const formularioInicial: MovimientoFormulario = {
  actividad_id: "",
  tipo: "Ingreso",
  concepto: "",
  monto: "",
  metodo_pago: "",
  responsable_id: "",
  persona_relacionada: "",
  observaciones: "",
};

function campoTexto(estado: MovimientoFormulario, campo: keyof MovimientoFormulario) {
  return estado[campo];
}

export default function FormularioMovimiento() {
  const supabase = useMemo(() => createClient(), []);
  const [actividades, setActividades] = useState<OpcionCatalogo[]>([]);
  const [responsables, setResponsables] = useState<OpcionCatalogo[]>([]);
  const [puedeCrear, setPuedeCrear] = useState(false);
  const [formulario, setFormulario] = useState<MovimientoFormulario>(formularioInicial);
  const [movimientoParaDuplicar, setMovimientoParaDuplicar] = useState<MovimientoFormulario | null>(null);
  const [loadingCatalogos, setLoadingCatalogos] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    async function cargarCatalogos() {
      setLoadingCatalogos(true);
      setError(null);

      const [actividadesResult, responsablesResult, rolResult] = await Promise.all([
        supabase
          .from("actividades")
          .select("id, nombre")
          .eq("activa", true)
          .order("nombre"),
        supabase
          .from("responsables")
          .select("id, nombre")
          .eq("activo", true)
          .order("nombre"),
        supabase.rpc("es_administrador"),
      ]);

      if (actividadesResult.error || responsablesResult.error) {
        setError(
          actividadesResult.error?.message ??
            responsablesResult.error?.message ??
            "No se pudieron cargar las opciones del formulario."
        );
        setLoadingCatalogos(false);
        return;
      }

      setActividades(actividadesResult.data ?? []);
      setResponsables(responsablesResult.data ?? []);
      setPuedeCrear(rolResult.data === true);
      setLoadingCatalogos(false);
    }

    cargarCatalogos();
  }, [supabase]);

  async function crearActividad(nombre: string) {
    const { data, error: insertError } = await supabase
      .from("actividades")
      .insert({ nombre })
      .select("id, nombre")
      .single();
    if (insertError) throw new Error(insertError.message);
    if (!data) return null;
    setActividades((actuales) => [...actuales, data].sort((actividadA, actividadB) => actividadA.nombre.localeCompare(actividadB.nombre)));
    return data;
  }

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

  function actualizarCampo<K extends keyof MovimientoFormulario>(
    campo: K,
    valor: MovimientoFormulario[K]
  ) {
    setFormulario((actual) => ({ ...actual, [campo]: valor }));
    setError(null);
    setMensaje(null);
  }

  async function enviarFormulario(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMensaje(null);

    const monto = Number(formulario.monto);
    if (!formulario.actividad_id || !formulario.responsable_id || !formulario.concepto.trim()) {
      setError("Completa la actividad, el concepto y el responsable.");
      return;
    }
    if (!Number.isFinite(monto) || monto <= 0) {
      setError("El monto debe ser un número mayor que cero.");
      return;
    }

    setGuardando(true);
    const movimiento = {
      actividad_id: formulario.actividad_id,
      tipo: formulario.tipo,
      concepto: formulario.concepto.trim(),
      monto,
      metodo_pago: formulario.metodo_pago || null,
      responsable_id: formulario.responsable_id,
      persona_relacionada: formulario.persona_relacionada.trim() || null,
      observaciones: formulario.observaciones.trim() || null,
      origen: "manual",
    };

    const { error: insertError } = await supabase.from("movimientos").insert(movimiento);
    setGuardando(false);

    if (insertError) {
      setError(`No se pudo guardar el movimiento: ${insertError.message}`);
      return;
    }

    setMovimientoParaDuplicar(formulario);
    setMensaje("Movimiento guardado correctamente.");
  }

  function duplicarMovimiento() {
    if (!movimientoParaDuplicar) return;
    setFormulario({
      ...movimientoParaDuplicar,
      persona_relacionada: "",
      monto: "",
    });
    setError(null);
    setMensaje("Movimiento duplicado. Completa el monto y la persona relacionada antes de guardar.");
  }

  const inputClass = "mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-navy-700)] focus:ring-2 focus:ring-[var(--color-navy-100)]";
  const labelClass = "block text-xs font-medium text-[var(--color-ink-soft)]";

  return (
    <section className="rounded-xl border border-[var(--color-line)] bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--color-ink)]">Registrar movimiento</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Agrega un ingreso o egreso manual a la caja.</p>
        </div>
        <button
          type="button"
          onClick={duplicarMovimiento}
          disabled={!movimientoParaDuplicar || guardando}
          className="rounded-lg border border-[var(--color-line)] bg-white px-3 py-2 text-sm font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-navy-50)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Duplicar movimiento
        </button>
      </div>

      {loadingCatalogos && (
        <p className="mb-4 rounded-lg bg-[var(--color-navy-50)] px-3 py-2 text-sm text-[var(--color-ink-soft)]">
          Cargando actividades y responsables…
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-lg bg-[var(--color-pending-bg)] px-3 py-2 text-sm text-[var(--color-pending)]">
          {error}
        </p>
      )}
      {mensaje && (
        <p className="mb-4 rounded-lg bg-[var(--color-ok-bg)] px-3 py-2 text-sm text-[var(--color-ok)]">
          {mensaje}
        </p>
      )}

      <form onSubmit={enviarFormulario} className="grid gap-4 sm:grid-cols-2">
        <div className={labelClass}>
          <span>Actividad</span>
          <SelectConCrear
            opciones={actividades}
            valor={campoTexto(formulario, "actividad_id")}
            onChange={(valor) => actualizarCampo("actividad_id", valor)}
            onCrear={crearActividad}
            puedeCrear={puedeCrear}
            disabled={loadingCatalogos || guardando}
            required
            placeholder="Selecciona una actividad"
            className={inputClass}
            ariaLabel="Actividad"
          />
        </div>

        <label className={labelClass}>
          Tipo
          <select
            value={formulario.tipo}
            onChange={(event) => actualizarCampo("tipo", event.target.value as TipoMovimiento)}
            disabled={guardando}
            className={inputClass}
          >
            <option value="Ingreso">Ingreso</option>
            <option value="Egreso">Egreso</option>
          </select>
        </label>

        <label className={labelClass}>
          Concepto
          <input
            required
            type="text"
            value={formulario.concepto}
            onChange={(event) => actualizarCampo("concepto", event.target.value)}
            disabled={guardando}
            className={inputClass}
            placeholder="Ej. Pago de reparación"
          />
        </label>

        <label className={labelClass}>
          Monto
          <input
            required
            min="0.01"
            step="0.01"
            type="number"
            value={formulario.monto}
            onChange={(event) => actualizarCampo("monto", event.target.value)}
            disabled={guardando}
            className={inputClass}
            placeholder="0.00"
          />
        </label>

        <label className={labelClass}>
          Método de pago <span className="font-normal">(opcional)</span>
          <select
            value={formulario.metodo_pago}
            onChange={(event) => actualizarCampo("metodo_pago", event.target.value as MetodoPago | "")}
            disabled={guardando}
            className={inputClass}
          >
            <option value="">Sin especificar</option>
            <option value="Efectivo">Efectivo</option>
            <option value="QR">QR</option>
          </select>
        </label>

        <div className={labelClass}>
          <span>Responsable</span>
          <SelectConCrear
            opciones={responsables}
            valor={formulario.responsable_id}
            onChange={(valor) => actualizarCampo("responsable_id", valor)}
            onCrear={crearResponsable}
            puedeCrear={puedeCrear}
            required
            disabled={loadingCatalogos || guardando}
            placeholder="Selecciona un responsable"
            className={inputClass}
            ariaLabel="Responsable"
          />
        </div>

        <label className={labelClass}>
          Persona relacionada <span className="font-normal">(opcional)</span>
          <input
            type="text"
            value={formulario.persona_relacionada}
            onChange={(event) => actualizarCampo("persona_relacionada", event.target.value)}
            disabled={guardando}
            className={inputClass}
          />
        </label>

        <label className={labelClass}>
          Observaciones <span className="font-normal">(opcional)</span>
          <textarea
            value={formulario.observaciones}
            onChange={(event) => actualizarCampo("observaciones", event.target.value)}
            disabled={guardando}
            className={`${inputClass} min-h-24 resize-y`}
          />
        </label>

        <div className="flex items-end sm:justify-end">
          <button
            type="submit"
            disabled={loadingCatalogos || guardando}
            className="w-full rounded-lg bg-[var(--color-navy-800)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-navy-900)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {guardando ? "Guardando…" : "Guardar movimiento"}
          </button>
        </div>
      </form>
    </section>
  );
}
