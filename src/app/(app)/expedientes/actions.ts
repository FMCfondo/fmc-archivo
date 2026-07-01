"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { consecutivos, documentos, expedientes } from "@/db/schema";
import { requireEmpresaId } from "@/lib/session";
import { cargarTipos, resolverSerie } from "@/lib/tipos";
import { urlDescarga } from "@/lib/r2";
import { registrarBitacora } from "@/lib/bitacora";
import { camposExpedienteSchema } from "@/lib/validacion";

type EstadoExpediente = "pendiente" | "completo" | "fusionado";

function str(v: FormDataEntryValue | null): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : null;
}

/** Genera/aplica el consecutivo de la serie del tipo, respetando un override. */
async function resolverConsecutivo(
  empresaId: string,
  tipoId: string,
  override: string | null,
): Promise<{ consecutivo: string; numero: number | null }> {
  const tipos = await cargarTipos(empresaId);
  const serie = resolverSerie(tipos, tipoId);

  if (override) {
    const m = override.match(/(\d+)\s*$/);
    const numero = m ? parseInt(m[1], 10) : null;
    if (numero != null) {
      // mantiene el contador al día sin retroceder
      await db
        .insert(consecutivos)
        .values({ empresaId, tipoId: serie.ownerId, ultimo: numero })
        .onConflictDoUpdate({
          target: [consecutivos.empresaId, consecutivos.tipoId],
          set: { ultimo: sql`greatest(${consecutivos.ultimo}, ${numero})` },
        });
    }
    return { consecutivo: override, numero };
  }

  const [c] = await db
    .insert(consecutivos)
    .values({ empresaId, tipoId: serie.ownerId, ultimo: 1 })
    .onConflictDoUpdate({
      target: [consecutivos.empresaId, consecutivos.tipoId],
      set: { ultimo: sql`${consecutivos.ultimo} + 1` },
    })
    .returning({ ultimo: consecutivos.ultimo });

  const numero = c.ultimo;
  const consecutivo =
    serie.prefijo && serie.libro
      ? `${serie.prefijo}-${serie.libro}-${numero}`
      : `${serie.codigo}-${numero}`;
  return { consecutivo, numero };
}

function leerCampos(formData: FormData) {
  const crudo = {
    periodo: str(formData.get("periodo")),
    fecha: str(formData.get("fecha")),
    tercero: str(formData.get("tercero")),
    nitTercero: str(formData.get("nitTercero")),
    concepto: str(formData.get("concepto")),
    valor: str(formData.get("valor")),
    estado: (str(formData.get("estado")) ?? "pendiente") as EstadoExpediente,
    rotuloCarpeta: str(formData.get("rotuloCarpeta")),
    ubicacionFisica: str(formData.get("ubicacionFisica")),
    folio: str(formData.get("folio")),
    notas: str(formData.get("notas")),
  };
  const r = camposExpedienteSchema.safeParse(crudo);
  if (!r.success) throw new Error(r.error.issues[0]?.message ?? "Datos inválidos.");
  return { ...r.data, tieneCarpetaFisica: formData.get("tieneCarpetaFisica") === "on" };
}

/** Crea un expediente (consecutivo automático o el que indique el usuario). */
export async function crearExpediente(formData: FormData) {
  const { session, empresaId } = await requireEmpresaId();
  const tipoId = str(formData.get("tipoId"));
  if (!tipoId) throw new Error("Selecciona un tipo de documento.");

  const { consecutivo, numero } = await resolverConsecutivo(
    empresaId,
    tipoId,
    str(formData.get("consecutivo")),
  );

  const [exp] = await db
    .insert(expedientes)
    .values({
      empresaId,
      tipoId,
      consecutivo,
      numero,
      ...leerCampos(formData),
      creadoPor: session.user.id,
    })
    .returning({ id: expedientes.id });

  await registrarBitacora({
    empresaId,
    usuarioId: session.user.id,
    accion: "crear",
    entidad: "expediente",
    entidadId: exp.id,
  });

  revalidatePath("/expedientes");
  redirect(`/expedientes/${exp.id}`);
}

/** Edita los datos de un expediente (incluido el consecutivo). */
export async function editarExpediente(formData: FormData) {
  const { session, empresaId } = await requireEmpresaId();
  const id = str(formData.get("id"));
  if (!id) throw new Error("Falta el identificador del expediente.");
  const tipoId = str(formData.get("tipoId"));

  await db
    .update(expedientes)
    .set({
      ...(tipoId ? { tipoId } : {}),
      consecutivo: str(formData.get("consecutivo")),
      ...leerCampos(formData),
      actualizadoEn: new Date(),
    })
    .where(
      and(eq(expedientes.id, id), eq(expedientes.empresaId, empresaId), isNull(expedientes.eliminadoEn)),
    );

  await registrarBitacora({
    empresaId,
    usuarioId: session.user.id,
    accion: "editar",
    entidad: "expediente",
    entidadId: id,
  });

  revalidatePath(`/expedientes/${id}`);
  redirect(`/expedientes/${id}`);
}

/** Elimina (soft-delete) un expediente y sus documentos. Queda en bitácora y es recuperable. */
export async function eliminarExpediente(formData: FormData) {
  const { session, empresaId } = await requireEmpresaId();
  const id = str(formData.get("id"));
  if (!id) return;

  const ahora = new Date();
  await db
    .update(documentos)
    .set({ eliminadoEn: ahora })
    .where(and(eq(documentos.expedienteId, id), eq(documentos.empresaId, empresaId)));
  await db
    .update(expedientes)
    .set({ eliminadoEn: ahora })
    .where(and(eq(expedientes.id, id), eq(expedientes.empresaId, empresaId)));

  await registrarBitacora({
    empresaId,
    usuarioId: session.user.id,
    accion: "eliminar",
    entidad: "expediente",
    entidadId: id,
  });

  revalidatePath("/expedientes");
  redirect("/expedientes");
}

/** URL prefirmada para abrir/descargar un documento. */
export async function obtenerUrlDescarga(documentoId: string) {
  const { empresaId } = await requireEmpresaId();
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

/** Elimina (soft-delete) un documento. El archivo en R2 se conserva para poder recuperarlo. */
export async function eliminarDocumento(documentoId: string) {
  const { session, empresaId } = await requireEmpresaId();
  const doc = (
    await db
      .select({ expedienteId: documentos.expedienteId })
      .from(documentos)
      .where(and(eq(documentos.id, documentoId), eq(documentos.empresaId, empresaId)))
      .limit(1)
  )[0];
  if (!doc) return;

  await db
    .update(documentos)
    .set({ eliminadoEn: new Date() })
    .where(and(eq(documentos.id, documentoId), eq(documentos.empresaId, empresaId)));

  await registrarBitacora({
    empresaId,
    usuarioId: session.user.id,
    accion: "eliminar_documento",
    entidad: "documento",
    entidadId: documentoId,
  });

  revalidatePath(`/expedientes/${doc.expedienteId}`);
}
