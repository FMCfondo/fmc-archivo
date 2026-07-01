"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { tiposDocumento } from "@/db/schema";
import { requireEmpresaId } from "@/lib/session";
import { str } from "@/lib/form";

async function siguienteOrden(empresaId: string): Promise<number> {
  const r = await db
    .select({ max: sql<number>`coalesce(max(${tiposDocumento.orden}), 0)` })
    .from(tiposDocumento)
    .where(eq(tiposDocumento.empresaId, empresaId));
  return (Number(r[0]?.max) || 0) + 1;
}

export async function crearCategoria(formData: FormData) {
  const { empresaId } = await requireEmpresaId();
  const codigo = str(formData.get("codigo"));
  const nombre = str(formData.get("nombre"));
  if (!codigo || !nombre) throw new Error("Código y nombre son obligatorios.");
  await db.insert(tiposDocumento).values({
    empresaId,
    codigo,
    nombre,
    prefijo: str(formData.get("prefijo")),
    libro: str(formData.get("libro")),
    parentId: null,
    orden: await siguienteOrden(empresaId),
  });
  revalidatePath("/catalogo");
}

export async function crearSubcategoria(formData: FormData) {
  const { empresaId } = await requireEmpresaId();
  const parentId = str(formData.get("parentId"));
  const codigo = str(formData.get("codigo"));
  const nombre = str(formData.get("nombre"));
  if (!parentId || !codigo || !nombre) throw new Error("Datos incompletos.");
  await db.insert(tiposDocumento).values({
    empresaId,
    codigo,
    nombre,
    prefijo: str(formData.get("prefijo")),
    libro: str(formData.get("libro")),
    parentId,
    orden: await siguienteOrden(empresaId),
  });
  revalidatePath("/catalogo");
}

export async function actualizarTipo(formData: FormData) {
  const { empresaId } = await requireEmpresaId();
  const id = str(formData.get("id"));
  const codigo = str(formData.get("codigo"));
  const nombre = str(formData.get("nombre"));
  if (!id || !codigo || !nombre) throw new Error("Datos incompletos.");
  await db
    .update(tiposDocumento)
    .set({
      codigo,
      nombre,
      prefijo: str(formData.get("prefijo")),
      libro: str(formData.get("libro")),
    })
    .where(and(eq(tiposDocumento.id, id), eq(tiposDocumento.empresaId, empresaId)));
  revalidatePath("/catalogo");
}

export async function toggleActivo(formData: FormData) {
  const { empresaId } = await requireEmpresaId();
  const id = str(formData.get("id"));
  if (!id) return;
  await db
    .update(tiposDocumento)
    .set({ activo: sql`not ${tiposDocumento.activo}` })
    .where(and(eq(tiposDocumento.id, id), eq(tiposDocumento.empresaId, empresaId)));
  revalidatePath("/catalogo");
}
