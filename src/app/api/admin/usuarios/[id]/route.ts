import { NextResponse } from "next/server";
import { getAuthenticatedAdminClient, getServiceRoleClient } from "@/lib/supabase/admin";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await getAuthenticatedAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { id } = await params;
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  if (userData.user.id === id) {
    return NextResponse.json(
      { error: "No puedes eliminar tu propia cuenta." },
      { status: 400 }
    );
  }

  const serviceClient = getServiceRoleClient();
  if (!serviceClient) {
    return NextResponse.json({ error: "Falta configurar SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 });
  }

  const [{ data: usuario, error: rolError }, { count, error: conteoError }] = await Promise.all([
    serviceClient.from("roles_usuario").select("rol").eq("user_id", id).maybeSingle(),
    serviceClient.from("roles_usuario").select("user_id", { count: "exact", head: true }).eq("rol", "Administrador"),
  ]);

  if (rolError || conteoError) {
    return NextResponse.json(
      { error: rolError?.message ?? conteoError?.message ?? "No se pudieron validar los roles." },
      { status: 500 }
    );
  }

  if (usuario?.rol === "Administrador" && count === 1) {
    return NextResponse.json(
      { error: "No puedes eliminar al único Administrador del sistema. Asigna el rol a otra persona primero." },
      { status: 400 }
    );
  }

  const { error: deleteError } = await serviceClient.auth.admin.deleteUser(id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id });
}