/** Ejecuta fn reintentando ante fallos transitorios (ej. "Failed to fetch"). */
export async function conReintentos<T>(fn: () => Promise<T>, intentos = 3, baseMs = 500): Promise<T> {
  let ultimoError: unknown;
  for (let i = 0; i < intentos; i++) {
    try {
      return await fn();
    } catch (e) {
      ultimoError = e;
      if (i < intentos - 1) await new Promise((r) => setTimeout(r, baseMs * (i + 1)));
    }
  }
  throw ultimoError;
}
