"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Rol = "Administrador" | "Encargada" | "Consulta";
type RolSeleccionado = Rol | "";

interface Usuario {
  id: string;
  email: string | null;
  created_at: string;
  rol: Rol | null;
}

function formatoFecha(fecha: string) {
  return new Date(fecha).toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function GestionUsuarios() {
  const supabase = useMemo(() => createClient(), []);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [usuarioActualId, setUsuarioActualId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [guardandoId, setGuardandoId] = useState<string | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [mostrandoFormulario, setMostrandoFormulario] = useState(false);
  const [emailInvitacion, setEmailInvitacion] = useState("");
  const [rolInvitacion, setRolInvitacion] = useState<Rol>("Consulta");
  const [invitando, setInvitando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function cargarUsuarios() {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/admin/usuarios", { cache: "no-store" });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      setError(body?.error ?? "No se pudieron cargar los usuarios.");
      setLoading(false);
      return;
    }

    setUsuarios(body as Usuario[]);
    setLoading(false);
  }

  useEffect(() => {
    async function cargarSesion() {
      const { data } = await supabase.auth.getUser();
      setUsuarioActualId(data.user?.id ?? null);
    }

    cargarSesion();
    cargarUsuarios();
  }, [supabase]);

  async function cambiarRol(usuario: Usuario, rol: RolSeleccionado) {
    const nuevoRol = rol || null;
    const esPropio = usuario.id === usuarioActualId;
    const vaAAdministrador = nuevoRol === "Administrador";
    const quitaAdministrador = usuario.rol === "Administrador" && nuevoRol !== "Administrador";
    const pierdeAccesoPropio = esPropio && nuevoRol !== "Administrador";

    const advertencias: string[] = [];
    if (vaAAdministrador) advertencias.push(`¿Confirmas asignar el rol Administrador a ${usuario.email ?? "este usuario"}?`);
    if (quitaAdministrador) advertencias.push(`¿Confirmas quitar el rol Administrador a ${usuario.email ?? "este usuario"}?`);
    if (pierdeAccesoPropio) advertencias.push("Vas a perder tus propios permisos de Administrador");

    if (advertencias.length > 0 && !confirm(advertencias.join("\n\n"))) return;

    setGuardandoId(usuario.id);
    setError(null);
    setMensaje(null);
    const response = await fetch(`/api/admin/usuarios/${usuario.id}/rol`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rol: nuevoRol }),
    });
    const body = await response.json().catch(() => null);
    setGuardandoId(null);

    if (!response.ok) {
      setError(body?.error ?? "No se pudo actualizar el rol.");
      return;
    }

    setUsuarios((actuales) => actuales.map((item) => (item.id === usuario.id ? { ...item, rol: nuevoRol } : item)));
    setMensaje("Rol actualizado correctamente.");
  }

  async function eliminarUsuario(usuario: Usuario) {
    const email = usuario.email ?? "este usuario";
    if (!confirm(`Esto eliminará permanentemente la cuenta de ${email}. Esta acción no se puede deshacer. ¿Continuar?`)) return;

    setEliminandoId(usuario.id);
    setError(null);
    setMensaje(null);
    const response = await fetch(`/api/admin/usuarios/${usuario.id}`, { method: "DELETE" });
    const body = await response.json().catch(() => null);
    setEliminandoId(null);

    if (!response.ok) {
      setError(body?.error ?? "No se pudo eliminar la cuenta.");
      return;
    }

    setUsuarios((actuales) => actuales.filter((item) => item.id !== usuario.id));
    setMensaje(`Cuenta de ${email} eliminada correctamente.`);
  }

  async function invitarUsuario(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInvitando(true);
    setError(null);
    setMensaje(null);

    const email = emailInvitacion.trim();
    const response = await fetch("/api/admin/usuarios/invitar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, rol: rolInvitacion }),
    });
    const body = await response.json().catch(() => null);
    setInvitando(false);

    if (!response.ok) {
      setError(body?.error ?? "No se pudo enviar la invitación.");
      return;
    }

    setUsuarios((actuales) => [...actuales, body as Usuario]);
    setMostrandoFormulario(false);
    setEmailInvitacion("");
    setRolInvitacion("Consulta");
    setMensaje(`Invitación enviada a ${body.email ?? email}`);
  }

  return (
    <section className="rounded-xl border border-[var(--color-line)] bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--color-line)] px-5 py-5 sm:px-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--color-ink)]">Gestión de usuarios</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Asigna el nivel de acceso de cada usuario del sistema.</p>
        </div>
        <button
          type="button"
          onClick={() => { setMostrandoFormulario((actual) => !actual); setError(null); setMensaje(null); }}
          className="rounded-lg bg-[var(--color-navy-700)] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-navy-800)]"
        >
          {mostrandoFormulario ? "Cancelar" : "Invitar usuario"}
        </button>
      </div>

      {mostrandoFormulario && (
        <form onSubmit={invitarUsuario} className="m-4 grid gap-4 rounded-lg border border-[var(--color-line)] bg-[var(--color-navy-50)] p-4 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end">
          <label className="block text-xs font-medium text-[var(--color-ink-soft)]">
            Email
            <input
              type="email"
              value={emailInvitacion}
              onChange={(event) => { setEmailInvitacion(event.target.value); setError(null); }}
              required
              autoFocus
              className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-navy-700)] focus:ring-2 focus:ring-[var(--color-navy-100)]"
            />
          </label>
          <label className="block text-xs font-medium text-[var(--color-ink-soft)]">
            Rol
            <select
              value={rolInvitacion}
              onChange={(event) => setRolInvitacion(event.target.value as Rol)}
              className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-navy-700)] focus:ring-2 focus:ring-[var(--color-navy-100)]"
            >
              <option value="Administrador">Administrador</option>
              <option value="Encargada">Encargada</option>
              <option value="Consulta">Consulta</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={invitando}
            className="rounded-lg bg-[var(--color-navy-700)] px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-navy-800)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {invitando ? "Enviando…" : "Enviar invitación"}
          </button>
        </form>
      )}

      {error && <p className="m-4 rounded-lg bg-[var(--color-pending-bg)] px-3 py-2 text-sm text-[var(--color-pending)]">{error}</p>}
      {mensaje && <p className="m-4 rounded-lg bg-[var(--color-ok-bg)] px-3 py-2 text-sm text-[var(--color-ok)]">{mensaje}</p>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-[var(--color-line)] bg-[var(--color-navy-50)]">
              <th className="px-4 py-3 text-left font-medium text-[var(--color-ink-soft)]">Email</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--color-ink-soft)]">Fecha de registro</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--color-ink-soft)]">Rol actual</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--color-ink-soft)]">Cambiar rol</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--color-ink-soft)]">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-[var(--color-ink-soft)]">Cargando usuarios…</td></tr>
            ) : usuarios.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-[var(--color-ink-soft)]">No hay usuarios disponibles.</td></tr>
            ) : (
              usuarios.map((usuario) => (
                <tr key={usuario.id} className="border-b border-[var(--color-line)] last:border-0 hover:bg-[var(--color-navy-50)]/50">
                  <td className="px-4 py-3 font-medium text-[var(--color-ink)]">{usuario.email ?? "Sin correo"}</td>
                  <td className="px-4 py-3 text-[var(--color-ink-soft)]">{formatoFecha(usuario.created_at)}</td>
                  <td className="px-4 py-3">
                    <span className={usuario.rol ? "text-[var(--color-ink)]" : "text-[var(--color-ink-soft)]"}>{usuario.rol ?? "Sin rol"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={usuario.rol ?? ""}
                      onChange={(event) => cambiarRol(usuario, event.target.value as RolSeleccionado)}
                      disabled={guardandoId === usuario.id || eliminandoId === usuario.id}
                      className="rounded-lg border border-[var(--color-line)] bg-white px-3 py-2 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-navy-700)] disabled:opacity-60"
                      aria-label={`Rol de ${usuario.email ?? "usuario"}`}
                    >
                      <option value="">Sin rol</option>
                      <option value="Administrador">Administrador</option>
                      <option value="Encargada">Encargada</option>
                      <option value="Consulta">Consulta</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => eliminarUsuario(usuario)}
                      disabled={usuario.id === usuarioActualId || guardandoId === usuario.id || eliminandoId === usuario.id}
                      title={usuario.id === usuarioActualId ? "No puedes eliminar tu propia cuenta" : undefined}
                      className="rounded-lg border border-[var(--color-line)] bg-white px-3 py-2 text-sm font-medium text-[var(--color-pending)] transition-colors hover:bg-[var(--color-pending-bg)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {eliminandoId === usuario.id ? "Eliminando…" : "Eliminar"}
                    </button>
                    {usuario.id === usuarioActualId && (
                      <span className="ml-2 text-xs text-[var(--color-ink-soft)]">No puedes eliminar tu propia cuenta</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
