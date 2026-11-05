import CargaRapidaMovimientos from "@/components/CargaRapidaMovimientos";
import FormularioMovimiento from "@/components/FormularioMovimiento";
import ListaMovimientos from "@/components/ListaMovimientos";

// TODO: crear componentes.
export default function MovimientosPage() {
  return (
    <>
      <FormularioMovimiento />
      <CargaRapidaMovimientos />
      <ListaMovimientos />
    </>
  );
}
