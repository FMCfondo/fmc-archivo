import { db } from "@/db";
import { bitacora } from "@/db/schema";

type Accion = "crear" | "editar" | "eliminar" | "subir_documento" | "eliminar_documento" | "mover";
type Entidad = "expediente" | "documento" | "tipo_documento";

/** Registra una acción en la bitácora de auditoría. Nunca lanza (no debe romper la operación principal). */
export async function registrarBitacora(input: {
  empresaId: string;
  usuarioId?: string | null;
  accion: Accion;
  entidad: Entidad;
  entidadId: string;
  detalle?: string;
}) {
  try {
    await db.insert(bitacora).values({
      empresaId: input.empresaId,
      usuarioId: input.usuarioId ?? null,
      accion: input.accion,
      entidad: input.entidad,
      entidadId: input.entidadId,
      detalle: input.detalle ?? null,
    });
  } catch (err) {
    console.error("No se pudo registrar en bitácora:", err);
  }
}
