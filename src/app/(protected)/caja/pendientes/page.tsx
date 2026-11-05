import { redirect } from "next/navigation";

export default function PendientesPage() {
  redirect("/caja/control-dinero?vista=pendientes");
}
