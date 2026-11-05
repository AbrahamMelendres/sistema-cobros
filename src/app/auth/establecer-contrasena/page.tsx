"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function EstablecerContrasenaPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [contrasena, setContrasena] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function cargarUsuarioInvitado() {
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? null);
      setCargandoSesion(false);
    }

    cargarUsuarioInvitado();
  }, [supabase]);

  async function guardarContrasena(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (contrasena.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (contrasena !== confirmacion) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setGuardando(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: contrasena });
    setGuardando(false);

    if (updateError) {
      const mensaje = updateError.message.toLowerCase();
      setError(
        mensaje.includes("different from the old password")
          ? "La nueva contraseña debe ser diferente de la anterior."
          : "No se pudo guardar la contraseña. Intenta nuevamente."
      );
      return;
    }

    router.push("/dia");
    router.refresh();
  }

  return (
    <div className="login-screen min-h-screen grid place-items-center px-4">
      <div className="login-card w-full max-w-sm rounded-2xl px-8 py-9">
        <h1 className="text-center font-display text-xl font-semibold text-[var(--color-ink)]">
          Crear contraseña
        </h1>
        <p className="mb-7 mt-1 text-center text-sm text-[var(--color-ink-soft)]">
          {cargandoSesion
            ? "Verificando tu invitación…"
            : email
              ? `Configura el acceso para ${email}.`
              : "El enlace de invitación no es válido o ya expiró."}
        </p>

        {!cargandoSesion && email && (
          <form onSubmit={guardarContrasena} className="space-y-4">
            <div>
              <label htmlFor="contrasena" className="mb-1.5 block text-xs font-medium text-[var(--color-ink-soft)]">
                Contraseña
              </label>
              <input
                id="contrasena"
                type="password"
                value={contrasena}
                onChange={(event) => setContrasena(event.target.value)}
                required
                minLength={6}
                autoFocus
                className="login-field w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-[var(--color-navy-700)] focus:ring-2 focus:ring-[var(--color-navy-100)]"
              />
            </div>
            <div>
              <label htmlFor="confirmacion" className="mb-1.5 block text-xs font-medium text-[var(--color-ink-soft)]">
                Repite la contraseña
              </label>
              <input
                id="confirmacion"
                type="password"
                value={confirmacion}
                onChange={(event) => setConfirmacion(event.target.value)}
                required
                minLength={6}
                className="login-field w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-[var(--color-navy-700)] focus:ring-2 focus:ring-[var(--color-navy-100)]"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-[var(--color-pending-bg)] px-3 py-2 text-sm text-[var(--color-pending)]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={guardando}
              className="login-submit w-full rounded-lg py-2.5 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            >
              {guardando ? "Guardando…" : "Guardar contraseña"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}