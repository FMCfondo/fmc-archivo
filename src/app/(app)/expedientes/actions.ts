"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { expedientes, type EstadoExpediente } from "@/db/schema";
import { requireEmpresaId } from "@/lib/session";
import { registrarBitacora } from "@/lib/bitacora";
import { camposExpedienteSchema } from "@/lib/validacion";
import { str } from "@/lib/form";
import { crearExpedienteNuevo, softDeleteExpediente } from "@/server/expedientes";
import { softDeleteSoporte, urlDescargaSoporte } from "@/server/documentos";

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

  // Se valida ANTES de asignar consecutivo: un dato inválido ya no deja huecos en la serie.
  const campos = leerCampos(formData);
  const id = await crearExpedienteNuevo({
    empresaId,
    usuarioId: session.user.id,
    tipoId,
    consecutivoOverride: str(formData.get("consecutivo")),
    campos,
  });

  revalidatePath("/expedientes");
  revalidatePath("/carpetas");
  redirect(`/expedientes/${id}`);
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
  revalidatePath("/carpetas");
  redirect(`/expedientes/${id}`);
}

/** Elimina (soft-delete) un expediente y sus documentos. Recuperable; queda en bitácora. */
export async function eliminarExpediente(formData: FormData) {
  const { session, empresaId } = await requireEmpresaId();
  const id = str(formData.get("id"));
  if (!id) return;

  await softDeleteExpediente({ empresaId, usuarioId: session.user.id, expedienteId: id });

  revalidatePath("/expedientes");
  revalidatePath("/carpetas");
  redirect("/expedientes");
}

/** URL prefirmada para abrir/descargar un documento. */
export async function obtenerUrlDescarga(documentoId: string) {
  const { empresaId } = await requireEmpresaId();
  return urlDescargaSoporte(empresaId, documentoId);
}

/** Elimina (soft-delete) un soporte. El archivo en R2 se conserva para poder recuperarlo. */
export async function eliminarDocumento(documentoId: string) {
  const { session, empresaId } = await requireEmpresaId();
  const res = await softDeleteSoporte({ empresaId, usuarioId: session.user.id, documentoId });
  if (res) {
    revalidatePath(`/expedientes/${res.expedienteId}`);
    revalidatePath("/carpetas");
  }
}
