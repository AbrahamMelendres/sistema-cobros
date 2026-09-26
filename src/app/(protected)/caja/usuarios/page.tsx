import { redirect } from "next/navigation";
import GestionUsuarios from "@/components/GestionUsuarios";
import { createClient } from "@/lib/supabase/server";

export default async function UsuariosPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("es_administrador");

  if (error || data !== true) {
    redirect("/caja");
  }

  return <GestionUsuarios />;
}
