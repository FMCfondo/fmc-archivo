/** Casos de uso sobre expedientes — validación de empresa, bitácora y soft-delete incluidos. */
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { documentos, expedientes } from "@/db/schema";
import { registrarBitacora } from "@/lib/bitacora";
import { asignarConsecutivo } from "./consecutivos";

type CamposExpediente = Partial<
  Omit<
    typeof expedientes.$inferInsert,
    "id" | "empresaId" | "tipoId" | "consecutivo" | "numero" | "creadoPor"
  >
>;

/** Crea un expediente con consecutivo de su serie (o el indicado) y lo registra en bitácora. */
export async function crearExpedienteNuevo(input: {
  empresaId: string;
  usuarioId: string;
  tipoId: string;
  consecutivoOverride?: string | null;
  campos?: CamposExpediente;
}): Promise<string> {
  const { consecutivo, numero } = await asignarConsecutivo(
    input.empresaId,
    input.tipoId,
    input.consecutivoOverride ?? null,
  );

  const [exp] = await db
    .insert(expedientes)
    .values({
      ...(input.campos ?? {}),
      empresaId: input.empresaId,
      tipoId: input.tipoId,
      consecutivo,
      numero,
      creadoPor: input.usuarioId,
    })
    .returning({ id: expedientes.id });

  await registrarBitacora({
    empresaId: input.empresaId,
    usuarioId: input.usuarioId,
    accion: "crear",
    entidad: "expediente",
    entidadId: exp.id,
  });

  return exp.id;
}

/** Soft-delete de un expediente y de sus soportes vivos (no pisa fechas de borrados previos). */
export async function softDeleteExpediente(input: {
  empresaId: string;
  usuarioId: string;
  expedienteId: string;
}): Promise<void> {
  const ahora = new Date();
  await db
    .update(documentos)
    .set({ eliminadoEn: ahora })
    .where(
      and(
        eq(documentos.expedienteId, input.expedienteId),
        eq(documentos.empresaId, input.empresaId),
        isNull(documentos.eliminadoEn),
      ),
    );
  await db
    .update(expedientes)
    .set({ eliminadoEn: ahora })
    .where(
      and(
        eq(expedientes.id, input.expedienteId),
        eq(expedientes.empresaId, input.empresaId),
        isNull(expedientes.eliminadoEn),
      ),
    );

  await registrarBitacora({
    empresaId: input.empresaId,
    usuarioId: input.usuarioId,
    accion: "eliminar",
    entidad: "expediente",
    entidadId: input.expedienteId,
  });
}
