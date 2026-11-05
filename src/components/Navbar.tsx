"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

export default function Navbar({ nombre }: { nombre: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { isAdmin: esAdministrador, error: roleError } = useUserRole(supabase);
  const [cajaAbierta, setCajaAbierta] = useState(false);
  const [informesAbiertos, setInformesAbiertos] = useState(false);
  const [masAbierto, setMasAbierto] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const linkClass = (href: string) =>
    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
      pathname.startsWith(href)
        ? "bg-[var(--color-navy-800)] text-white"
        : "text-[var(--color-ink-soft)] hover:bg-[var(--color-navy-100)]"
    }`;
  const informeActivo = pathname === "/informe" || pathname === "/caja/informes";
  const mobileLinks = [
    ["Movimientos", "/caja/movimientos"],
    ["Control de dinero", "/caja/control-dinero"],
    ["Informe de caja", "/caja/informes"],
    ["Nosotros", "/sobre-nosotros"],
    ...(esAdministrador
      ? [["Usuarios", "/caja/usuarios"], ["Catálogos", "/caja/catalogos"], ["Bitácora", "/caja/bitacora"]]
      : []),
  ];

  return (
    <header className="site-header border-b border-[var(--color-line)] bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Image
            src="/logo.jpeg"
            alt="Academia Técnica"
            width={36}
            height={36}
            className="rounded-full shrink-0"
          />
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold text-[var(--color-ink)] leading-tight truncate">
              Registro de Cobros
            </p>
            <p className="text-[11px] text-[var(--color-ink-soft)] leading-tight truncate">
              Donde nace el conocimiento, florece un futuro sin límites
            </p>
          </div>
        </div>

        <nav className="hidden sm:flex items-center gap-1 shrink-0">
          <Link href="/dia" className={linkClass("/dia")}>
            Día
          </Link>
          <div className="relative">
            <button
              type="button"
              onClick={() => setCajaAbierta((abierta) => !abierta)}
              aria-haspopup="menu"
              aria-expanded={cajaAbierta}
              className={linkClass("/caja")}
            >
              Caja <span className="ml-1 text-xs">▾</span>
            </button>
            {cajaAbierta && (
              <div
                role="menu"
                className="absolute right-0 top-full z-40 mt-2 w-44 rounded-lg border border-[var(--color-line)] bg-white p-1 shadow-lg"
              >
                {[
                  ["Inicio", "/caja"],
                  ["Movimientos", "/caja/movimientos"],
                  ["Control de dinero", "/caja/control-dinero"],
                  ...(esAdministrador
                    ? [["Usuarios", "/caja/usuarios"], ["Catálogos", "/caja/catalogos"], ["Bitácora", "/caja/bitacora"]]
                    : []),
                ].map(([label, href]) => (
                  <Link
                    key={href}
                    href={href}
                    role="menuitem"
                    onClick={() => setCajaAbierta(false)}
                    className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                      pathname === href
                        ? "bg-[var(--color-navy-800)] text-white"
                        : "text-[var(--color-ink-soft)] hover:bg-[var(--color-navy-100)]"
                    }`}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setInformesAbiertos((abiertos) => !abiertos)}
              aria-haspopup="menu"
              aria-expanded={informesAbiertos}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                informeActivo
                  ? "bg-[var(--color-navy-800)] text-white"
                  : "text-[var(--color-ink-soft)] hover:bg-[var(--color-navy-100)]"
              }`}
            >
              Informes <span className="ml-1 text-xs">▾</span>
            </button>
            {informesAbiertos && (
              <div
                role="menu"
                className="absolute right-0 top-full z-40 mt-2 w-52 rounded-lg border border-[var(--color-line)] bg-white p-1 shadow-lg"
              >
                {[
                  ["Cobros", "/informe"],
                  ["Caja", "/caja/informes"],
                ].map(([label, href]) => (
                  <Link
                    key={href}
                    href={href}
                    role="menuitem"
                    onClick={() => setInformesAbiertos(false)}
                    className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                      pathname === href
                        ? "bg-[var(--color-navy-800)] text-white"
                        : "text-[var(--color-ink-soft)] hover:bg-[var(--color-navy-100)]"
                    }`}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <Link href="/sobre-nosotros" className={linkClass("/sobre-nosotros")}>
            Nosotros
          </Link>
        </nav>

        <div className="hidden sm:flex items-center gap-3 shrink-0">
          <span className="text-sm text-[var(--color-ink-soft)]">{nombre}</span>
          <button
            onClick={handleLogout}
            className="rounded-lg bg-[#0f766e] px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[#115e59] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5eead4]"
          >
            Salir
          </button>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="shrink-0 rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-xs font-semibold text-[var(--color-ink)] sm:hidden"
        >
          Salir
        </button>
      </div>
      {roleError && (
        <p role="alert" className="border-t border-[var(--color-line)] bg-[var(--color-pending-bg)] px-4 py-2 text-center text-xs text-[var(--color-pending)]">
          No se pudo verificar el rol: {roleError}
        </p>
      )}
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-[var(--color-line)] bg-[#090e19]/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1 shadow-[0_-8px_24px_rgb(0_0_0_/_25%)] backdrop-blur-xl sm:hidden"
      >
        {[
          { href: "/dia", label: "Día", icon: "⌂", active: pathname === "/dia" },
          { href: "/caja", label: "Caja", icon: "◉", active: pathname.startsWith("/caja") },
          { href: "/informe", label: "Informes", icon: "▥", active: informeActivo },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex min-w-0 flex-col items-center gap-0.5 rounded-lg py-1 text-[10px] font-medium transition-colors ${
              item.active ? "text-emerald-400" : "text-slate-400"
            }`}
          >
            <span aria-hidden="true" className="text-lg leading-5">{item.icon}</span>
            {item.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setMasAbierto((abierto) => !abierto)}
          aria-expanded={masAbierto}
          aria-haspopup="menu"
          className={`flex min-w-0 flex-col items-center gap-0.5 rounded-lg py-1 text-[10px] font-medium transition-colors ${
            masAbierto ? "text-emerald-400" : "text-slate-400"
          }`}
        >
          <span aria-hidden="true" className="text-lg leading-5">⋯</span>
          Más
        </button>
      </nav>
      {masAbierto && (
        <div
          role="menu"
          className="fixed bottom-[calc(3.75rem+env(safe-area-inset-bottom))] right-3 z-40 w-56 rounded-xl border border-[var(--color-line)] bg-[#101827] p-1 shadow-xl sm:hidden"
        >
          {mobileLinks.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              role="menuitem"
              onClick={() => setMasAbierto(false)}
              className={`block rounded-lg px-3 py-2.5 text-sm ${
                pathname === href ? "bg-emerald-600/20 text-emerald-300" : "text-slate-200 hover:bg-white/5"
              }`}
            >
              {label}
            </Link>
          ))}
          <p className="truncate border-t border-white/10 px-3 py-2 text-xs text-slate-400">{nombre}</p>
        </div>
      )}
    </header>
  );
}
