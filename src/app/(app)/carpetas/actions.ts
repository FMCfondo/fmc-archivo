"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { tiposDocumento, expedientes, documentos } from "@/db/schema";
import { requireEmpresaId } from "@/lib/session";
import { registrarBitacora } from "@/lib/bitacora";
import { guardarDocumentoSchema } from "@/lib/validacion";
import { str } from "@/lib/form";

/** Crea una carpeta o subcarpeta (si viene parentId). */
export async function crearCarpeta(formData: FormData) {
  const { session, empresaId } = await requireEmpresaId();
  const nombre = str(formData.get("nombre"));
  if (!nombre) throw new Error("El nombre de la carpeta es obligatorio.");
  const parentId = str(formData.get("parentId"));
  const codigo = str(formData.get("codigo")) ?? `C-${Date.now().toString(36)}`;

  const [{ maxOrden }] = await db
    .select({ maxOrden: sql<number>`coalesce(max(${tiposDocumento.orden}), 0)` })
    .from(tiposDocumento)
    .where(eq(tiposDocumento.empresaId, empresaId));

  const [tipo] = await db
    .insert(tiposDocumento)
    .values({
      empresaId,
      codigo,
      nombre,
      prefijo: str(formData.get("prefijo")),
      libro: str(formData.get("libro")),
      parentId: parentId ?? null,
      orden: (Number(maxOrden) || 0) + 1,
    })
    .returning({ id: tiposDocumento.id });

  await registrarBitacora({
    empresaId,
    usuarioId: session.user.id,
    accion: "crear",
    entidad: "tipo_documento",
    entidadId: tipo.id,
    detalle: nombre,
  });

  revalidatePath(parentId ? `/carpetas/${parentId}` : "/carpetas");
}

/** Guarda nombre, tipo (mueve de carpeta) y carpeta física de un documento. */
export async function guardarDocumento(formData: FormData) {
  const { session, empresaId } = await requireEmpresaId();
  const r = guardarDocumentoSchema.safeParse({
    id: str(formData.get("id")),
    nombre: str(formData.get("nombre")),
    tipoId: str(formData.get("tipoId")),
    rotulo: str(formData.get("rotulo")),
    ubicacion: str(formData.get("ubicacion")),
  });
  if (!r.success) throw new Error(r.error.issues[0]?.message ?? "Datos inválidos.");
  const { id, nombre, tipoId, rotulo, ubicacion } = r.data;
  const aplica = formData.get("tieneCarpetaFisica") === "on";

  await db
    .update(expedientes)
    .set({
      concepto: nombre,
      ...(tipoId ? { tipoId } : {}),
      tieneCarpetaFisica: aplica,
      rotuloCarpeta: aplica ? rotulo : null,
      ubicacionFisica: aplica ? ubicacion : null,
      actualizadoEn: new Date(),
    })
    .where(
      and(eq(expedientes.id, id), eq(expedientes.empresaId, empresaId), isNull(expedientes.eliminadoEn)),
    );

  await registrarBitacora({
    empresaId,
    usuarioId: session.user.id,
    accion: tipoId ? "mover" : "editar",
    entidad: "expediente",
    entidadId: id,
  });

  const carpetaActual = str(formData.get("carpetaActual"));
  if (carpetaActual) revalidatePath(`/carpetas/${carpetaActual}`);
}

/** Elimina (soft-delete) un documento (fila) y sus soportes. Recuperable desde bitácora. */
export async function eliminarFila(id: string, carpetaActual: string) {
  const { session, empresaId } = await requireEmpresaId();
  const ahora = new Date();
  await db
    .update(documentos)
    .set({ eliminadoEn: ahora })
    .where(
      and(
        eq(documentos.expedienteId, id),
        eq(documentos.empresaId, empresaId),
        isNull(documentos.eliminadoEn),
      ),
    );
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

  if (carpetaActual) revalidatePath(`/carpetas/${carpetaActual}`);
}
