import { NextResponse } from "next/server";
import { getAuthenticatedAdminClient, getServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Rol = "Administrador" | "Encargada" | "Consulta";

export async function GET() {
  if (!(await getAuthenticatedAdminClient())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const serviceClient = getServiceRoleClient();
  if (!serviceClient) {
    return NextResponse.json({ error: "Falta configurar SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 });
  }

  const [{ data: usersData, error: usersError }, { data: roles, error: rolesError }] = await Promise.all([
    serviceClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    serviceClient.from("roles_usuario").select("user_id, rol"),
  ]);

  if (usersError || rolesError) {
    return NextResponse.json(
      { error: usersError?.message ?? rolesError?.message ?? "No se pudieron cargar los usuarios." },
      { status: 500 }
    );
  }

  const rolesPorUsuario = new Map((roles ?? []).map((item) => [item.user_id, item.rol as Rol]));
  const usuarios = usersData.users.map((user) => ({
    id: user.id,
    email: user.email ?? null,
    created_at: user.created_at,
    rol: rolesPorUsuario.get(user.id) ?? null,
  }));

  return NextResponse.json(usuarios);
}
