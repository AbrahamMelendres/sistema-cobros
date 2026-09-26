import { NextResponse } from "next/server";
import { getAuthenticatedAdminClient, getServiceRoleClient } from "@/lib/supabase/admin";

const ROLES = ["Administrador", "Encargada", "Consulta"] as const;
type Rol = (typeof ROLES)[number];

function esEmailValido(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  const supabase = await getAuthenticatedAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  let body: { email?: unknown; rol?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "El cuerpo de la solicitud no es válido." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!esEmailValido(email)) {
    return NextResponse.json({ error: "Ingresa un correo electrónico válido." }, { status: 400 });
  }
  if (!ROLES.includes(body.rol as Rol)) {
    return NextResponse.json({ error: "Selecciona un rol válido para el usuario." }, { status: 400 });
  }

  const serviceClient = getServiceRoleClient();
  if (!serviceClient) {
    return NextResponse.json({ error: "Falta configurar SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 });
  }

  const rol = body.rol as Rol;
  const redirectTo = new URL("/auth/establecer-contrasena", request.url).toString();
  const { data, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (inviteError) {
    const errorText = `${inviteError.code ?? ""} ${inviteError.message}`.toLowerCase();
    if (errorText.includes("email_exists") || errorText.includes("already registered") || errorText.includes("already exists")) {
      return NextResponse.json(
        { error: "Ese correo ya tiene una cuenta. Asígnale el rol directamente desde la tabla." },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: inviteError.message }, { status: 500 });
  }

  if (!data.user) {
    return NextResponse.json({ error: "Supabase no devolvió el usuario invitado." }, { status: 500 });
  }

  const { error: roleError } = await serviceClient
    .from("roles_usuario")
    .upsert({ user_id: data.user.id, rol }, { onConflict: "user_id" });
  if (roleError) {
    return NextResponse.json(
      { error: `La invitación se envió correctamente, pero no se pudo asignar el rol automáticamente. Busca a ${email} en la tabla de usuarios y asígnale el rol manualmente.` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    id: data.user.id,
    email: data.user.email ?? email,
    created_at: data.user.created_at,
    rol,
  });
}