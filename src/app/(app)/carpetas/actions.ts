"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { tiposDocumento, expedientes, documentos, consecutivos } from "@/db/schema";
import { requireEmpresaId } from "@/lib/session";
import { cargarTipos, resolverSerie } from "@/lib/tipos";
import { eliminarObjeto } from "@/lib/r2";

function str(v: FormDataEntryValue | null): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : null;
}

/** Crea una carpeta o subcarpeta (si viene parentId). */
export async function crearCarpeta(formData: FormData) {
  const { empresaId } = await requireEmpresaId();
  const nombre = str(formData.get("nombre"));
  if (!nombre) throw new Error("El nombre de la carpeta es obligatorio.");
  const parentId = str(formData.get("parentId"));
  const codigo = str(formData.get("codigo")) ?? `C-${Date.now().toString(36)}`;

  const [{ maxOrden }] = await db
    .select({ maxOrden: sql<number>`coalesce(max(${tiposDocumento.orden}), 0)` })
    .from(tiposDocumento)
    .where(eq(tiposDocumento.empresaId, empresaId));

  await db.insert(tiposDocumento).values({
    empresaId,
    codigo,
    nombre,
    prefijo: str(formData.get("prefijo")),
    libro: str(formData.get("libro")),
    parentId: parentId ?? null,
    orden: (Number(maxOrden) || 0) + 1,
  });

  revalidatePath(parentId ? `/carpetas/${parentId}` : "/carpetas");
}

/** Crea un documento (fila) en una carpeta y devuelve su id para subir el archivo. */
export async function crearDocumentoRapido(tipoId: string, nombre: string) {
  const { session, empresaId } = await requireEmpresaId();
  const tipos = await cargarTipos(empresaId);
  const serie = resolverSerie(tipos, tipoId);

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

  const [exp] = await db
    .insert(expedientes)
    .values({ empresaId, tipoId, consecutivo, numero, concepto: nombre, creadoPor: session.user.id })
    .returning({ id: expedientes.id });

  return { id: exp.id };
}

/** Guarda nombre, tipo (mueve de carpeta) y carpeta física de un documento. */
export async function guardarDocumento(formData: FormData) {
  const { empresaId } = await requireEmpresaId();
  const id = str(formData.get("id"));
  if (!id) return;
  const tipoId = str(formData.get("tipoId"));
  const aplica = formData.get("tieneCarpetaFisica") === "on";

  await db
    .update(expedientes)
    .set({
      concepto: str(formData.get("nombre")),
      ...(tipoId ? { tipoId } : {}),
      tieneCarpetaFisica: aplica,
      rotuloCarpeta: aplica ? str(formData.get("rotulo")) : null,
      ubicacionFisica: aplica ? str(formData.get("ubicacion")) : null,
      actualizadoEn: new Date(),
    })
    .where(and(eq(expedientes.id, id), eq(expedientes.empresaId, empresaId)));

  const carpetaActual = str(formData.get("carpetaActual"));
  if (carpetaActual) revalidatePath(`/carpetas/${carpetaActual}`);
}

/** Elimina un documento (fila) completo, con sus archivos en R2. */
export async function eliminarFila(id: string, carpetaActual: string) {
  const { empresaId } = await requireEmpresaId();
  const docs = await db
    .select({ r2Key: documentos.r2Key })
    .from(documentos)
    .where(and(eq(documentos.expedienteId, id), eq(documentos.empresaId, empresaId)));
  for (const d of docs) {
    try {
      await eliminarObjeto(d.r2Key);
    } catch {
      // continuar
    }
  }
  await db.delete(expedientes).where(and(eq(expedientes.id, id), eq(expedientes.empresaId, empresaId)));
  if (carpetaActual) revalidatePath(`/carpetas/${carpetaActual}`);
}
