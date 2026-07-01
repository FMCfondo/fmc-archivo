/**
 * Detecta el tipo real de un archivo por sus "magic bytes" (firma binaria),
 * sin confiar en el Content-Type ni la extensión que envía el navegador.
 */
const FIRMAS: Record<string, (b: Uint8Array) => boolean> = {
  "application/pdf": (b) =>
    b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d, // %PDF-
  "image/jpeg": (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) =>
    b.length >= 8 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a,
};

const EXT_POR_MIME: Record<string, string[]> = {
  "application/pdf": ["pdf"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
};

/** Devuelve el mime REAL detectado por contenido, o null si no es un formato permitido. */
export function detectarTipoReal(bytes: Uint8Array): string | null {
  for (const [mime, chequear] of Object.entries(FIRMAS)) {
    if (chequear(bytes)) return mime;
  }
  return null;
}

/** true si la extensión del nombre de archivo es coherente con el mime real detectado. */
export function extensionCoherente(mime: string, nombreArchivo: string): boolean {
  const ext = nombreArchivo.toLowerCase().split(".").pop() ?? "";
  return (EXT_POR_MIME[mime] ?? []).includes(ext);
}
