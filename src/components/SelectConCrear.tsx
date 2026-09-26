"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface OpcionSelectConCrear {
  id: string;
  nombre: string;
}

interface SelectConCrearProps {
  opciones: OpcionSelectConCrear[];
  valor: string;
  onChange: (valor: string) => void;
  onCrear: (nombre: string) => Promise<OpcionSelectConCrear | null>;
  puedeCrear?: boolean;
  placeholder: string;
  className: string;
  required?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
}

export default function SelectConCrear({
  opciones,
  valor,
  onChange,
  onCrear,
  puedeCrear: puedeCrearProp,
  placeholder,
  className,
  required = false,
  disabled = false,
  ariaLabel,
}: SelectConCrearProps) {
  const supabase = useMemo(() => createClient(), []);
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [puedeCrear, setPuedeCrear] = useState(Boolean(puedeCrearProp));

  useEffect(() => {
    async function verificarPermiso() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setPuedeCrear(false);
        return;
      }

      const { data } = await supabase.rpc("es_administrador");
      setPuedeCrear(data === true);
    }

    void verificarPermiso();
  }, [supabase]);

  const puedeCrearActual = puedeCrearProp || puedeCrear;

  function cancelar() {
    setCreando(false);
    setNombre("");
    setError(null);
  }

  async function guardar() {
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) {
      setError("Escribe un nombre.");
      return;
    }

    setGuardando(true);
    setError(null);
    try {
      const opcion = await onCrear(nombreLimpio);
      if (!opcion) {
        setError("No se pudo guardar la opción.");
        return;
      }
      onChange(opcion.id);
      cancelar();
    } catch (errorDesconocido) {
      setError(errorDesconocido instanceof Error ? errorDesconocido.message : "No se pudo guardar la opción.");
    } finally {
      setGuardando(false);
    }
  }

  if (creando) {
    return (
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={nombre}
            onChange={(event) => { setNombre(event.target.value); setError(null); }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void guardar();
              }
            }}
            disabled={guardando || disabled}
            autoFocus
            className={`${className} min-w-0 flex-1`}
            aria-label="Nombre de la nueva opción"
          />
          <button
            type="button"
            onClick={() => { void guardar(); }}
            disabled={guardando || disabled}
            className="rounded-md bg-[var(--color-navy-800)] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-navy-900)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {guardando ? "Guardando…" : "Guardar"}
          </button>
          <button
            type="button"
            onClick={cancelar}
            disabled={guardando || disabled}
            className="rounded-md border border-[var(--color-line)] bg-white px-3 py-2 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-navy-50)] disabled:opacity-60"
          >
            Cancelar
          </button>
        </div>
        {error && <p role="alert" className="mt-1 text-xs text-[var(--color-pending)]">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <select
        required={required}
        value={valor}
        onChange={(event) => {
          if (event.target.value === "__agregar_nuevo__") {
            setCreando(true);
            setNombre("");
            setError(null);
            return;
          }
          onChange(event.target.value);
        }}
        disabled={guardando || disabled}
        className={className}
        aria-label={ariaLabel}
      >
        <option value="">{placeholder}</option>
        {opciones.map((opcion) => (
          <option key={opcion.id} value={opcion.id}>{opcion.nombre}</option>
        ))}
        {puedeCrearActual && <option value="__agregar_nuevo__">+ Agregar nuevo...</option>}
      </select>
      {error && <p role="alert" className="mt-1 text-xs text-[var(--color-pending)]">{error}</p>}
    </div>
  );
}
