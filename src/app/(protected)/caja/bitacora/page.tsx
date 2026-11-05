import { redirect } from "next/navigation";
import BitacoraAdmin from "@/components/BitacoraAdmin";
import { createClient } from "@/lib/supabase/server";

export default async function BitacoraPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("es_administrador");

  if (error || data !== true) {
    redirect("/caja");
  }

  return <BitacoraAdmin />;
}
