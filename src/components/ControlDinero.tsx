"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CustodiaPanel from "@/components/CustodiaPanel";
import PendientesPanel from "@/components/PendientesPanel";

type VistaControlDinero = "pendientes" | "custodia";

export default function ControlDinero({
  vistaInicial = "pendientes",
}: {
  vistaInicial?: VistaControlDinero;
}) {
  const router = useRouter();
  const [vista, setVista] = useState(vistaInicial);

  function cambiarVista(siguienteVista: VistaControlDinero) {
    setVista(siguienteVista);
    router.replace(`/caja/control-dinero?vista=${siguienteVista}`, { scroll: false });
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-[var(--color-ink)]">
          Control de dinero
        </h1>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
          Administra pendientes y revisa el dinero entregado a cada responsable.
        </p>
      </header>

      <div
        role="tablist"
        aria-label="Secciones de control de dinero"
        className="mb-6 flex w-fit gap-1 rounded-xl border border-[var(--color-line)] bg-white p-1"
      >
        {([
          ["pendientes", "Pendientes"],
          ["custodia", "Custodia"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            id={`control-dinero-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={vista === id}
            aria-controls={`control-dinero-panel-${id}`}
            onClick={() => cambiarVista(id)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              vista === id
                ? "bg-[var(--color-navy-800)] text-white"
                : "text-[var(--color-ink-soft)] hover:bg-[var(--color-navy-50)] hover:text-[var(--color-ink)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <section
        id={`control-dinero-panel-${vista}`}
        role="tabpanel"
        aria-labelledby={`control-dinero-tab-${vista}`}
      >
        {vista === "pendientes" ? <PendientesPanel /> : <CustodiaPanel />}
      </section>
    </div>
  );
}
