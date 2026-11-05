import ControlDinero from "@/components/ControlDinero";

type VistaControlDinero = "pendientes" | "custodia";

export default async function ControlDineroPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string }>;
}) {
  const { vista } = await searchParams;
  const vistaInicial: VistaControlDinero = vista === "custodia" ? "custodia" : "pendientes";

  return <ControlDinero vistaInicial={vistaInicial} />;
}
