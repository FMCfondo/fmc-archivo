import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { usuariosEmpresas, empresas, type Rol } from "@/db/schema";
import { RUTA_INICIO } from "@/lib/constantes";

export type { Rol };
export type Membresia = { empresaId: string; rol: Rol; nombre: string };

/** Devuelve la sesión o redirige al login. */
export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session;
}

/**
 * Devuelve la sesión + la empresa activa (de la cookie si el usuario es miembro,
 * si no la primera) + el rol en esa empresa + todas sus membresías.
 */
export async function requireEmpresaId() {
  const session = await requireSession();

  const membresias = (await db
    .select({
      empresaId: usuariosEmpresas.empresaId,
      rol: usuariosEmpresas.rol,
      nombre: empresas.nombre,
    })
    .from(usuariosEmpresas)
    .innerJoin(empresas, eq(usuariosEmpresas.empresaId, empresas.id))
    .where(eq(usuariosEmpresas.usuarioId, session.user.id))) as Membresia[];

  if (membresias.length === 0) redirect("/login");

  const elegida = (await cookies()).get("empresaActiva")?.value;
  let empresaId =
    elegida && membresias.some((m) => m.empresaId === elegida)
      ? elegida
      : session.user.empresaId ?? membresias[0].empresaId;
  if (!membresias.some((m) => m.empresaId === empresaId)) empresaId = membresias[0].empresaId;

  const rol = membresias.find((m) => m.empresaId === empresaId)?.rol ?? "lector";
  return { session, empresaId, rol, membresias };
}

/** Igual que requireEmpresaId pero exige rol admin en la empresa activa. */
export async function requireAdmin() {
  const ctx = await requireEmpresaId();
  if (ctx.rol !== "admin") redirect(RUTA_INICIO);
  return ctx;
}
