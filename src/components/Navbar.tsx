"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Navbar({ nombre }: { nombre: string }) {
  const pathname = usePathname();
  const router = useRouter();

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

  return (
    <header className="border-b border-[var(--color-line)] bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
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
              Academia Técnica de Ingeniería y Tecnologías Informáticas
            </p>
          </div>
        </div>

        <nav className="flex items-center gap-1 shrink-0">
          <Link href="/dia" className={linkClass("/dia")}>
            Día
          </Link>
          <Link href="/informe" className={linkClass("/informe")}>
            Informe
          </Link>
        </nav>

        <div className="hidden sm:flex items-center gap-3 shrink-0">
          <span className="text-sm text-[var(--color-ink-soft)]">{nombre}</span>
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-[var(--color-navy-800)] hover:text-[var(--color-navy-900)]"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
