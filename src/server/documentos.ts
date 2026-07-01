/** Casos de uso sobre soportes/archivos (tabla `documentos`). */
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { documentos, expedientes, type TipoSoporte } from "@/db/schema";
import { registrarBitacora } from "@/lib/bitacora";
import { urlDescarga } from "@/lib/r2";

/** Registra un soporte ya subido a R2, validando que el expediente exista, sea de la empresa y esté vivo. */
export async function registrarSoporte(input: {
  empresaId: string;
  usuarioId: string;
  expedienteId: string;
  tipoSoporte: TipoSoporte;
  nombreArchivo: string;
  r2Key: string;
  mime: string;
  tamano: number;
}): Promise<string> {
  const exp = (
    await db
      .select({ id: expedientes.id })
      .from(expedientes)
      .where(
        and(
          eq(expedientes.id, input.expedienteId),
          eq(expedientes.empresaId, input.empresaId),
          isNull(expedientes.eliminadoEn),
        ),
      )
      .limit(1)
  )[0];
  if (!exp) throw new Error("Expediente no encontrado.");

  const [doc] = await db
    .insert(documentos)
    .values({
      expedienteId: input.expedienteId,
      empresaId: input.empresaId,
      tipoSoporte: input.tipoSoporte,
      nombreArchivo: input.nombreArchivo,
      r2Key: input.r2Key,
      mime: input.mime,
      tamano: input.tamano,
      subidoPor: input.usuarioId,
    })
    .returning({ id: documentos.id });

  await registrarBitacora({
    empresaId: input.empresaId,
    usuarioId: input.usuarioId,
    accion: "subir_documento",
    entidad: "documento",
    entidadId: doc.id,
    detalle: input.nombreArchivo,
  });

  return doc.id;
}

/** Soft-delete de un soporte. Devuelve el expediente al que pertenecía, o null si no existe. */
export async function softDeleteSoporte(input: {
  empresaId: string;
  usuarioId: string;
  documentoId: string;
}): Promise<{ expedienteId: string } | null> {
  const doc = (
    await db
      .select({ expedienteId: documentos.expedienteId })
      .from(documentos)
      .where(and(eq(documentos.id, input.documentoId), eq(documentos.empresaId, input.empresaId)))
      .limit(1)
  )[0];
  if (!doc) return null;

  await db
    .update(documentos)
    .set({ eliminadoEn: new Date() })
    .where(
      and(
        eq(documentos.id, input.documentoId),
        eq(documentos.empresaId, input.empresaId),
        isNull(documentos.eliminadoEn),
      ),
    );

  await registrarBitacora({
    empresaId: input.empresaId,
    usuarioId: input.usuarioId,
    accion: "eliminar_documento",
    entidad: "documento",
    entidadId: input.documentoId,
  });

  return { expedienteId: doc.expedienteId };
}

/** URL prefirmada de descarga de un soporte vivo de la empresa. */
export async function urlDescargaSoporte(empresaId: string, documentoId: string): Promise<string> {
  const doc = (
    await db
      .select({ r2Key: documentos.r2Key })
      .from(documentos)
      .where(
        and(
          eq(documentos.id, documentoId),
          eq(documentos.empresaId, empresaId),
          isNull(documentos.eliminadoEn),
        ),
      )
      .limit(1)
  )[0];
  if (!doc) throw new Error("Documento no encontrado.");
  return urlDescarga(doc.r2Key);
}
