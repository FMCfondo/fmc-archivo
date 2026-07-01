/** Helpers para leer FormData en server actions. */

/** Texto recortado, o null si viene vacío o no es string. */
export function str(v: FormDataEntryValue | null): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : null;
}
