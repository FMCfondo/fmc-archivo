"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { empresas, usuarios, usuariosEmpresas } from "@/db/schema";
import { requireSession, requireAdmin, type Rol } from "@/lib/session";
import { str } from "@/lib/form";
import { BCRYPT_COST, MIN_PASSWORD, RUTA_INICIO } from "@/lib/constantes";

/** Cambia la empresa activa (guarda la elección en una cookie). */
export async function cambiarEmpresa(formData: FormData) {
  const session = await requireSession();
  const empresaId = str(formData.get("empresaId"));
  if (!empresaId) return;
  const memb = (
    await db
      .select({ id: usuariosEmpresas.id })
      .from(usuariosEmpresas)
      .where(
        and(
          eq(usuariosEmpresas.usuarioId, session.user.id),
          eq(usuariosEmpresas.empresaId, empresaId),
        ),
      )
      .limit(1)
  )[0];
  if (!memb) return;
  (await cookies()).set("empresaActiva", empresaId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
  redirect(RUTA_INICIO);
}

/** Crea una nueva empresa y deja al usuario actual como admin. */
export async function crearEmpresa(formData: FormData) {
  const session = await requireSession();
  const nombre = str(formData.get("nombre"));
  if (!nombre) throw new Error("El nombre de la empresa es obligatorio.");
  const [emp] = await db
    .insert(empresas)
    .values({ nombre, nit: str(formData.get("nit")) })
    .returning();
  await db
    .insert(usuariosEmpresas)
    .values({ usuarioId: session.user.id, empresaId: emp.id, rol: "admin" });
  (await cookies()).set("empresaActiva", emp.id, { path: "/", httpOnly: true, sameSite: "lax" });
  revalidatePath("/", "layout");
  redirect(RUTA_INICIO);
}

/** Renombra/actualiza la empresa activa (solo admin). */
export async function renombrarEmpresa(formData: FormData) {
  const { empresaId } = await requireAdmin();
  const nombre = str(formData.get("nombre"));
  if (!nombre) return;
  await db
    .update(empresas)
    .set({ nombre, nit: str(formData.get("nit")) })
    .where(eq(empresas.id, empresaId));
  revalidatePath("/", "layout");
  revalidatePath("/equipo");
}

/** Agrega un miembro a la empresa (crea el usuario si no existe). */
export async function agregarMiembro(formData: FormData) {
  const { empresaId } = await requireAdmin();
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const nombre = str(formData.get("nombre")) ?? email;
  const rol = (str(formData.get("rol")) ?? "editor") as Rol;
  const password = String(formData.get("password") ?? "");
  if (!email) throw new Error("El correo es obligatorio.");

  let user = (await db.select().from(usuarios).where(eq(usuarios.email, email)).limit(1))[0];
  if (!user) {
    if (password.length < MIN_PASSWORD) {
      throw new Error(
        `Para un usuario nuevo, la contraseña temporal debe tener al menos ${MIN_PASSWORD} caracteres.`,
      );
    }
    user = (
      await db
        .insert(usuarios)
        .values({ email, nombre, passwordHash: await bcrypt.hash(password, BCRYPT_COST) })
        .returning()
    )[0];
  }

  await db
    .insert(usuariosEmpresas)
    .values({ usuarioId: user.id, empresaId, rol })
    .onConflictDoNothing();
  revalidatePath("/equipo");
}

/** Cambia el rol de un miembro (solo admin). */
export async function cambiarRol(formData: FormData) {
  const { empresaId } = await requireAdmin();
  const usuarioId = str(formData.get("usuarioId"));
  const rol = str(formData.get("rol")) as Rol | null;
  if (!usuarioId || !rol) return;
  await db
    .update(usuariosEmpresas)
    .set({ rol })
    .where(
      and(eq(usuariosEmpresas.usuarioId, usuarioId), eq(usuariosEmpresas.empresaId, empresaId)),
    );
  revalidatePath("/equipo");
}

/** Quita a un miembro de la empresa (solo admin; no a sí mismo). */
export async function quitarMiembro(formData: FormData) {
  const { session, empresaId } = await requireAdmin();
  const usuarioId = str(formData.get("usuarioId"));
  if (!usuarioId) return;
  if (usuarioId === session.user.id) throw new Error("No puedes quitarte a ti mismo.");
  await db
    .delete(usuariosEmpresas)
    .where(
      and(eq(usuariosEmpresas.usuarioId, usuarioId), eq(usuariosEmpresas.empresaId, empresaId)),
    );
  revalidatePath("/equipo");
}
