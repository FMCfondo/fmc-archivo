"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { RUTA_INICIO } from "@/lib/constantes";

export async function loginAction(_prev: string | undefined, formData: FormData) {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: RUTA_INICIO,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return "Correo o contraseña incorrectos.";
    }
    // signIn lanza un redirect de Next cuando tiene éxito: hay que re-lanzarlo.
    throw error;
  }
  return undefined;
}
