"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { tiposDocumento } from "@/db/schema";
import { requireEmpresaId } from "@/lib/session";
import { str } from "@/lib/form";
import { crearTipoDocumento } from "@/server/carpetas";

export async function crearCategoria(formData: FormData) {
  const { session, empresaId } = await requireEmpresaId();
  const codigo = str(formData.get("codigo"));
  const nombre = str(formData.get("nombre"));
  if (!codigo || !nombre) throw new Error("Código y nombre son obligatorios.");
  await crearTipoDocumento({
    empresaId,
    usuarioId: session.user.id,
    nombre,
    codigo,
    prefijo: str(formData.get("prefijo")),
    libro: str(formData.get("libro")),
    parentId: null,
  });
  revalidatePath("/catalogo");
  revalidatePath("/carpetas");
}

export async function crearSubcategoria(formData: FormData) {
  const { session, empresaId } = await requireEmpresaId();
  const parentId = str(formData.get("parentId"));
  const codigo = str(formData.get("codigo"));
  const nombre = str(formData.get("nombre"));
  if (!parentId || !codigo || !nombre) throw new Error("Datos incompletos.");
  await crearTipoDocumento({
    empresaId,
    usuarioId: session.user.id,
    nombre,
    codigo,
    prefijo: str(formData.get("prefijo")),
    libro: str(formData.get("libro")),
    parentId,
  });
  revalidatePath("/catalogo");
  revalidatePath("/carpetas");
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
  revalidatePath("/carpetas");
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
  revalidatePath("/carpetas");
}
