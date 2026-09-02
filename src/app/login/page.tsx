"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError("Correo o contraseña incorrectos.");
      return;
    }

    router.push("/dia");
    router.refresh();
  }

  return (
    <div className="min-h-screen grid place-items-center bg-[var(--color-navy-950)] px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Image
            src="/logo.jpeg"
            alt="Academia Técnica de Ingeniería y Tecnologías Informáticas"
            width={104}
            height={104}
            className="rounded-full bg-white p-2"
            priority
          />
        </div>

        <div className="bg-white rounded-2xl shadow-xl px-8 py-9">
          <h1 className="font-display text-xl font-semibold text-[var(--color-ink)] text-center mb-1">
            Registro de Cobros
          </h1>
          <p className="text-sm text-[var(--color-ink-soft)] text-center mb-7">
            Inicia sesión para continuar
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium text-[var(--color-ink-soft)] mb-1.5"
              >
                Correo
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy-700)] focus:border-transparent"
                placeholder="tu.nombre@academiatecnica.local"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-[var(--color-ink-soft)] mb-1.5"
              >
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy-700)] focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-sm text-[var(--color-pending)] bg-[var(--color-pending-bg)] rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[var(--color-navy-800)] text-white text-sm font-medium py-2.5 hover:bg-[var(--color-navy-900)] transition-colors disabled:opacity-60"
            >
              {loading ? "Ingresando…" : "Iniciar sesión"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-white/50 mt-6">
          Academia Técnica de Ingeniería y Tecnologías Informáticas
        </p>
      </div>
    </div>
  );
}
