"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AccionBitacora = "INSERT" | "UPDATE" | "DELETE";
type TablaBitacora =
  | "registros"
  | "movimientos"
  | "pendientes"
  | "custodia_movimientos"
  | "actividades"
  | "responsables"
  | "profiles"
  | "roles_usuario";

interface EntradaBitacora {
  id: number;
  tabla: TablaBitacora;
  accion: AccionBitacora;
  registro_id: string | null;
  usuario_id: string | null;
  usuario_email: string | null;
  campos_cambiados: string[];
  created_at: string;
}

const nombresTabla: Record<TablaBitacora, string> = {
  registros: "Cobros",
  movimientos: "Movimientos de caja",
  pendientes: "Pendientes",
  custodia_movimientos: "Custodia",
  actividades: "Actividades",
  responsables: "Responsables",
  profiles: "Perfiles",
  roles_usuario: "Roles de usuario",
};

const nombresAccion: Record<AccionBitacora, string> = {
  INSERT: "Creación",
  UPDATE: "Edición",
  DELETE: "Eliminación",
};

function fechaHora(valor: string) {
  return new Date(valor).toLocaleString("es-BO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function BitacoraAdmin() {
  const supabase = useMemo(() => createClient(), []);
  const [entradas, setEntradas] = useState<EntradaBitacora[]>([]);
  const [loading, setLoading] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtroTabla, setFiltroTabla] = useState<TablaBitacora | "">("");
  const [filtroAccion, setFiltroAccion] = useState<AccionBitacora | "">("");

  const cargar = useCallback(async () => {
    setActualizando(true);
    setError(null);

    let query = supabase
      .from("bitacora")
      .select("id, tabla, accion, registro_id, usuario_id, usuario_email, campos_cambiados, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (filtroTabla) query = query.eq("tabla", filtroTabla);
    if (filtroAccion) query = query.eq("accion", filtroAccion);

    const { data, error: queryError } = await query;
    if (queryError) {
      setError(
        queryError.code === "42P01"
          ? "La tabla de bitácora aún no existe. Aplica la migración supabase/migrations/20261105_bitacora.sql en el SQL Editor de Supabase."
          : `No se pudo cargar la bitácora: ${queryError.message}`
      );
      setEntradas([]);
    } else {
      setEntradas((data ?? []) as EntradaBitacora[]);
    }

    setLoading(false);
    setActualizando(false);
  }, [filtroAccion, filtroTabla, supabase]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--color-ink)]">Bitácora</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            Registro de cambios recientes. Se muestran hasta 100 eventos y no se guardan los valores de los campos.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void cargar()}
          disabled={actualizando}
          className="rounded-lg border border-[var(--color-line)] bg-white px-3 py-2 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-navy-50)] disabled:opacity-60"
        >
          {actualizando ? "Actualizando…" : "Actualizar"}
        </button>
      </header>

      <div className="flex flex-wrap gap-3 rounded-xl border border-[var(--color-line)] bg-white p-3">
        <label className="text-xs font-medium text-[var(--color-ink-soft)]">
          Módulo
          <select
            value={filtroTabla}
            onChange={(event) => setFiltroTabla(event.target.value as TablaBitacora | "")}
            className="mt-1 block rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm font-normal text-[var(--color-ink)]"
          >
            <option value="">Todos</option>
            {Object.entries(nombresTabla).map(([tabla, nombre]) => (
              <option key={tabla} value={tabla}>{nombre}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-[var(--color-ink-soft)]">
          Acción
          <select
            value={filtroAccion}
            onChange={(event) => setFiltroAccion(event.target.value as AccionBitacora | "")}
            className="mt-1 block rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm font-normal text-[var(--color-ink)]"
          >
            <option value="">Todas</option>
            {Object.entries(nombresAccion).map(([accion, nombre]) => (
              <option key={accion} value={accion}>{nombre}</option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-[var(--color-pending-bg)] px-3 py-2 text-sm text-[var(--color-pending)]">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-[var(--color-line)] bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-[var(--color-navy-50)] text-[var(--color-ink-soft)]">
            <tr>
              <th className="px-3 py-2.5 font-medium">Fecha y hora</th>
              <th className="px-3 py-2.5 font-medium">Usuario</th>
              <th className="px-3 py-2.5 font-medium">Acción</th>
              <th className="px-3 py-2.5 font-medium">Módulo</th>
              <th className="px-3 py-2.5 font-medium">Campos modificados</th>
              <th className="px-3 py-2.5 font-medium">ID del registro</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-[var(--color-ink-soft)]">Cargando bitácora…</td></tr>
            )}
            {!loading && !error && entradas.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-[var(--color-ink-soft)]">No hay eventos para mostrar.</td></tr>
            )}
            {!loading && entradas.map((entrada) => (
              <tr key={entrada.id} className="border-t border-[var(--color-line)] align-top">
                <td className="whitespace-nowrap px-3 py-3">{fechaHora(entrada.created_at)}</td>
                <td className="px-3 py-3">{entrada.usuario_email ?? entrada.usuario_id ?? "Sistema"}</td>
                <td className="px-3 py-3">{nombresAccion[entrada.accion]}</td>
                <td className="px-3 py-3">{nombresTabla[entrada.tabla]}</td>
                <td className="px-3 py-3">{entrada.campos_cambiados.length ? entrada.campos_cambiados.join(", ") : "—"}</td>
                <td className="max-w-48 break-all px-3 py-3 font-mono text-xs">{entrada.registro_id ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
