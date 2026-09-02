export type MetodoPago = "Efectivo" | "QR";
export type Estado = "Pendiente" | "Cancelado";
export type TipoEquipo = "Pc" | "Laptop";

export interface Registro {
  id: string;
  fecha: string; // YYYY-MM-DD
  numero: number | null;
  nombre_completo: string | null;
  ci: string | null;
  celular: string | null;
  monto: number;
  metodo_pago: MetodoPago | null;
  estado: Estado;
  observaciones: string | null;
  tipo_equipo: TipoEquipo | null;
  encargada: string | null;
  created_at: string;
}

export type RegistroInput = Omit<Registro, "id" | "created_at">;
