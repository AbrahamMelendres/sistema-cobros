import { NextResponse } from "next/server";
import { getAuthenticatedAdminClient } from "@/lib/supabase/admin";

const ROLES = ["Administrador", "Encargada", "Consulta"] as const;
type Rol = (typeof ROLES)[number];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await getAuthenticatedAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { id } = await params;
  let body: { rol?: Rol | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "El cuerpo de la solicitud no es válido." }, { status: 400 });
  }

  if (body.rol !== null && !ROLES.includes(body.rol as Rol)) {
    return NextResponse.json({ error: "El rol indicado no es válido." }, { status: 400 });
  }

  if (body.rol === null) {
    const { error } = await supabase.from("roles_usuario").delete().eq("user_id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await supabase
      .from("roles_usuario")
      .upsert({ user_id: id, rol: body.rol }, { onConflict: "user_id" });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, id, rol: body.rol });
}
