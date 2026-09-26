import { redirect } from "next/navigation";
import GestionCatalogos from "@/components/GestionCatalogos";
import { createClient } from "@/lib/supabase/server";

export default async function CatalogosPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("es_administrador");

  if (error || data !== true) {
    redirect("/caja");
  }

  return <GestionCatalogos />;
}
