"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { usuarios } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { BCRYPT_COST, MIN_PASSWORD } from "@/lib/constantes";

export type EstadoCambio = { error?: string; ok?: boolean };

export async function cambiarPassword(
  _prev: EstadoCambio | undefined,
  formData: FormData,
): Promise<EstadoCambio> {
  const session = await requireSession();
  const actual = String(formData.get("actual") ?? "");
  const nueva = String(formData.get("nueva") ?? "");
  const confirmar = String(formData.get("confirmar") ?? "");

  if (nueva.length < MIN_PASSWORD) {
    return { error: `La nueva contraseña debe tener al menos ${MIN_PASSWORD} caracteres.` };
  }
  if (nueva !== confirmar) return { error: "La confirmación no coincide." };

  const user = (
    await db.select().from(usuarios).where(eq(usuarios.id, session.user.id)).limit(1)
  )[0];
  if (!user || !(await bcrypt.compare(actual, user.passwordHash))) {
    return { error: "La contraseña actual es incorrecta." };
  }
  if (await bcrypt.compare(nueva, user.passwordHash)) {
    return { error: "La nueva contraseña debe ser diferente a la actual." };
  }

  await db
    .update(usuarios)
    .set({ passwordHash: await bcrypt.hash(nueva, BCRYPT_COST), debeCambiarPassword: false })
    .where(eq(usuarios.id, session.user.id));

  return { ok: true };
}
