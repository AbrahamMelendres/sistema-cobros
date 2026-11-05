import { redirect } from "next/navigation";

export default function CustodiaPage() {
  redirect("/caja/control-dinero?vista=custodia");
}
