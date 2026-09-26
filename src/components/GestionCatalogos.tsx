"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Actividad = {
  id: string;
  nombre: string;
  activa: boolean;
};

type Responsable = {
  id: string;
  nombre: string;
  activo: boolean;
};

type TipoCatalogo = "actividad" | "responsable";

function estadoTexto(estado: boolean, tipo: TipoCatalogo) {
  if (tipo === "actividad") {
    return estado ? "Activa" : "Inactiva";
  }
  return estado ? "Activo" : "Inactivo";
}

export default function GestionCatalogos() {
  const supabase = useMemo(() => createClient(), []);
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [responsables, setResponsables] = useState<Responsable[]>([]);
  const [nombreActividad, setNombreActividad] = useState("");
  const [nombreResponsable, setNombreResponsable] = useState("");
  const [loading, setLoading] = useState(true);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);
  const [procesandoTipo, setProcesandoTipo] = useState<TipoCatalogo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const cargarCatalogos = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [actividadesResult, responsablesResult] = await Promise.all([
      supabase.from("actividades").select("id, nombre, activa").order("nombre"),
      supabase.from("responsables").select("id, nombre, activo").order("nombre"),
    ]);

    if (actividadesResult.error || responsablesResult.error) {
      setError(
        actividadesResult.error?.message ??
          responsablesResult.error?.message ??
          "No se pudieron cargar los catálogos."
      );
      setLoading(false);
      return;
    }

    setActividades((actividadesResult.data ?? []) as Actividad[]);
    setResponsables((responsablesResult.data ?? []) as Responsable[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void cargarCatalogos();
  }, [cargarCatalogos]);

  async function obtenerTablasConReferencia(tipo: TipoCatalogo, id: string) {
    if (tipo === "actividad") {
      const [movimientosResult, registrosResult, pendientesResult] = await Promise.all([
        supabase.from("movimientos").select("id", { count: "exact", head: true }).eq("actividad_id", id),
        supabase.from("registros").select("id", { count: "exact", head: true }).eq("actividad_id", id),
        supabase.from("pendientes").select("id", { count: "exact", head: true }).eq("actividad_id", id),
      ]);

      const tablas: string[] = [];
      if ((movimientosResult.count ?? 0) > 0) tablas.push("movimientos");
      if ((registrosResult.count ?? 0) > 0) tablas.push("registros");
      if ((pendientesResult.count ?? 0) > 0) tablas.push("pendientes");
      return tablas;
    }

    const [movimientosResult, pendientesResult, custodiaResult] = await Promise.all([
      supabase.from("movimientos").select("id", { count: "exact", head: true }).eq("responsable_id", id),
      supabase.from("pendientes").select("id", { count: "exact", head: true }).eq("responsable_id", id),
      supabase.from("custodia_movimientos").select("id", { count: "exact", head: true }).eq("responsable_id", id),
    ]);

    const tablas: string[] = [];
    if ((movimientosResult.count ?? 0) > 0) tablas.push("movimientos");
    if ((pendientesResult.count ?? 0) > 0) tablas.push("pendientes");
    if ((custodiaResult.count ?? 0) > 0) tablas.push("custodia_movimientos");
    return tablas;
  }

  async function crearActividad(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nombre = nombreActividad.trim();
    if (!nombre) {
      setError("Escribe el nombre de la actividad.");
      return;
    }

    setError(null);
    setMensaje(null);

    const { data, error: insertError } = await supabase
      .from("actividades")
      .insert({ nombre })
      .select("id, nombre, activa")
      .single();

    if (insertError || !data) {
      setError(insertError?.message ?? "No se pudo crear la actividad.");
      return;
    }

    setActividades((actuales) => [...actuales, data].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    setNombreActividad("");
    setMensaje("Actividad creada correctamente.");
  }

  async function crearResponsable(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nombre = nombreResponsable.trim();
    if (!nombre) {
      setError("Escribe el nombre del responsable.");
      return;
    }

    setError(null);
    setMensaje(null);

    const { data, error: insertError } = await supabase
      .from("responsables")
      .insert({ nombre })
      .select("id, nombre, activo")
      .single();

    if (insertError || !data) {
      setError(insertError?.message ?? "No se pudo crear el responsable.");
      return;
    }

    setResponsables((actuales) => [...actuales, data].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    setNombreResponsable("");
    setMensaje("Responsable creado correctamente.");
  }

  async function alternarActividad(item: Actividad) {
    const nuevoEstado = !item.activa;
    setProcesandoId(item.id);
    setProcesandoTipo("actividad");
    setError(null);
    setMensaje(null);

    const { error: updateError } = await supabase
      .from("actividades")
      .update({ activa: nuevoEstado })
      .eq("id", item.id);

    setProcesandoId(null);
    setProcesandoTipo(null);

    if (updateError) {
      setError(updateError.message ?? "No se pudo cambiar el estado de la actividad.");
      return;
    }

    setActividades((actuales) => actuales.map((actual) => actual.id === item.id ? { ...actual, activa: nuevoEstado } : actual));
    setMensaje(`Actividad ${nuevoEstado ? "reactivada" : "desactivada"} correctamente.`);
  }

  async function alternarResponsable(item: Responsable) {
    const nuevoEstado = !item.activo;
    setProcesandoId(item.id);
    setProcesandoTipo("responsable");
    setError(null);
    setMensaje(null);

    const { error: updateError } = await supabase
      .from("responsables")
      .update({ activo: nuevoEstado })
      .eq("id", item.id);

    setProcesandoId(null);
    setProcesandoTipo(null);

    if (updateError) {
      setError(updateError.message ?? "No se pudo cambiar el estado del responsable.");
      return;
    }

    setResponsables((actuales) => actuales.map((actual) => actual.id === item.id ? { ...actual, activo: nuevoEstado } : actual));
    setMensaje(`Responsable ${nuevoEstado ? "reactivado" : "desactivado"} correctamente.`);
  }

  async function eliminarActividad(item: Actividad) {
    const tablasConReferencia = await obtenerTablasConReferencia("actividad", item.id);
    if (tablasConReferencia.length > 0) {
      const tablas = tablasConReferencia.join(", ");
      setError(`No se puede eliminar esta actividad porque ya tiene referencias en ${tablas}. Desactívala en su lugar.`);
      return;
    }

    if (!confirm(`¿Deseas eliminar la actividad "${item.nombre}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    setProcesandoId(item.id);
    setProcesandoTipo("actividad");
    setError(null);
    setMensaje(null);

    const { error: deleteError } = await supabase.from("actividades").delete().eq("id", item.id);

    setProcesandoId(null);
    setProcesandoTipo(null);

    if (deleteError) {
      setError(deleteError.message ?? "No se pudo eliminar la actividad.");
      return;
    }

    setActividades((actuales) => actuales.filter((actual) => actual.id !== item.id));
    setMensaje("Actividad eliminada correctamente.");
  }

  async function eliminarResponsable(item: Responsable) {
    const tablasConReferencia = await obtenerTablasConReferencia("responsable", item.id);
    if (tablasConReferencia.length > 0) {
      const tablas = tablasConReferencia.join(", ");
      setError(`No se puede eliminar este responsable porque ya tiene referencias en ${tablas}. Desactívalo en su lugar.`);
      return;
    }

    if (!confirm(`¿Deseas eliminar al responsable "${item.nombre}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    setProcesandoId(item.id);
    setProcesandoTipo("responsable");
    setError(null);
    setMensaje(null);

    const { error: deleteError } = await supabase.from("responsables").delete().eq("id", item.id);

    setProcesandoId(null);
    setProcesandoTipo(null);

    if (deleteError) {
      setError(deleteError.message ?? "No se pudo eliminar el responsable.");
      return;
    }

    setResponsables((actuales) => actuales.filter((actual) => actual.id !== item.id));
    setMensaje("Responsable eliminado correctamente.");
  }

  function renderTablaActividades() {
    if (loading) {
      return <p className="px-4 py-8 text-center text-sm text-[var(--color-ink-soft)]">Cargando actividades…</p>;
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[440px] text-sm">
          <thead>
            <tr className="border-b border-[var(--color-line)] bg-[var(--color-navy-50)]">
              <th className="px-4 py-3 text-left font-medium text-[var(--color-ink-soft)]">Nombre</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--color-ink-soft)]">Estado</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--color-ink-soft)]">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {actividades.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-[var(--color-ink-soft)]">No hay actividades creadas.</td>
              </tr>
            ) : (
              actividades.map((actividad) => (
                <tr key={actividad.id} className="border-b border-[var(--color-line)] last:border-0">
                  <td className="px-4 py-3 font-medium text-[var(--color-ink)]">{actividad.nombre}</td>
                  <td className="px-4 py-3 text-[var(--color-ink-soft)]">{estadoTexto(actividad.activa, "actividad")}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void alternarActividad(actividad)}
                        disabled={procesandoId === actividad.id}
                        className="rounded-lg border border-[var(--color-line)] bg-white px-3 py-2 text-xs font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-navy-50)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {procesandoId === actividad.id && procesandoTipo === "actividad" ? "Guardando…" : actividad.activa ? "Desactivar" : "Reactivar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void eliminarActividad(actividad)}
                        disabled={procesandoId === actividad.id}
                        className="rounded-lg border border-[var(--color-line)] bg-white px-3 py-2 text-xs font-medium text-[var(--color-pending)] transition-colors hover:bg-[var(--color-pending-bg)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  }

  function renderTablaResponsables() {
    if (loading) {
      return <p className="px-4 py-8 text-center text-sm text-[var(--color-ink-soft)]">Cargando responsables…</p>;
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[440px] text-sm">
          <thead>
            <tr className="border-b border-[var(--color-line)] bg-[var(--color-navy-50)]">
              <th className="px-4 py-3 text-left font-medium text-[var(--color-ink-soft)]">Nombre</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--color-ink-soft)]">Estado</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--color-ink-soft)]">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {responsables.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-[var(--color-ink-soft)]">No hay responsables creados.</td>
              </tr>
            ) : (
              responsables.map((responsable) => (
                <tr key={responsable.id} className="border-b border-[var(--color-line)] last:border-0">
                  <td className="px-4 py-3 font-medium text-[var(--color-ink)]">{responsable.nombre}</td>
                  <td className="px-4 py-3 text-[var(--color-ink-soft)]">{estadoTexto(responsable.activo, "responsable")}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void alternarResponsable(responsable)}
                        disabled={procesandoId === responsable.id}
                        className="rounded-lg border border-[var(--color-line)] bg-white px-3 py-2 text-xs font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-navy-50)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {procesandoId === responsable.id && procesandoTipo === "responsable" ? "Guardando…" : responsable.activo ? "Desactivar" : "Reactivar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void eliminarResponsable(responsable)}
                        disabled={procesandoId === responsable.id}
                        className="rounded-lg border border-[var(--color-line)] bg-white px-3 py-2 text-xs font-medium text-[var(--color-pending)] transition-colors hover:bg-[var(--color-pending-bg)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="rounded-xl border border-[var(--color-line)] bg-white p-5 shadow-sm">
        <h1 className="font-display text-2xl font-semibold text-[var(--color-ink)]">Catálogos</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
          Administra actividades y responsables. Los elementos en uso no se eliminan; se desactivan para mantener la integridad histórica.
        </p>
      </header>

      {error && <p className="rounded-lg bg-[var(--color-pending-bg)] px-3 py-2 text-sm text-[var(--color-pending)]">{error}</p>}
      {mensaje && <p className="rounded-lg bg-[var(--color-ok-bg)] px-3 py-2 text-sm text-[var(--color-ok)]">{mensaje}</p>}

      <section className="rounded-xl border border-[var(--color-line)] bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">Actividades</h2>
        </div>

        <form onSubmit={crearActividad} className="mb-5 flex flex-wrap gap-3">
          <input
            type="text"
            value={nombreActividad}
            onChange={(event) => setNombreActividad(event.target.value)}
            placeholder="Nombre de la actividad"
            className="min-w-[220px] flex-1 rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-navy-700)] focus:ring-2 focus:ring-[var(--color-navy-100)]"
          />
          <button
            type="submit"
            className="rounded-lg bg-[var(--color-navy-800)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-navy-900)]"
          >
            Crear
          </button>
        </form>

        {renderTablaActividades()}
      </section>

      <section className="rounded-xl border border-[var(--color-line)] bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">Responsables</h2>
        </div>

        <form onSubmit={crearResponsable} className="mb-5 flex flex-wrap gap-3">
          <input
            type="text"
            value={nombreResponsable}
            onChange={(event) => setNombreResponsable(event.target.value)}
            placeholder="Nombre del responsable"
            className="min-w-[220px] flex-1 rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-navy-700)] focus:ring-2 focus:ring-[var(--color-navy-100)]"
          />
          <button
            type="submit"
            className="rounded-lg bg-[var(--color-navy-800)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-navy-900)]"
          >
            Crear
          </button>
        </form>

        {renderTablaResponsables()}
      </section>
    </div>
  );
}
