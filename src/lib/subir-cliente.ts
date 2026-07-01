/** Subida de archivos desde el navegador — única implementación para todos los componentes. */
import { conReintentos } from "@/lib/reintentos";
import { MAX_SUBIDA_TEXTO } from "@/lib/constantes";
import type { TipoSoporte } from "@/db/schema";

export type DestinoSubida =
  | { tipoId: string } // crea un documento nuevo en la carpeta
  | { expedienteId: string; tipoSoporte: TipoSoporte }; // agrega un soporte a un documento

/**
 * Sube archivos uno a uno vía POST /api/subir (con reintentos).
 * Devuelve la lista de fallos ("nombre: motivo"); vacía si todo subió.
 */
export async function subirArchivos(
  files: File[],
  destino: DestinoSubida,
  onProgreso?: (actual: number, total: number) => void,
): Promise<string[]> {
  const fallos: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgreso?.(i + 1, files.length);
    try {
      const fd = new FormData();
      fd.set("file", file);
      if ("tipoId" in destino) {
        fd.set("tipoId", destino.tipoId);
      } else {
        fd.set("expedienteId", destino.expedienteId);
        fd.set("tipoSoporte", destino.tipoSoporte);
      }
      await conReintentos(async () => {
        const r = await fetch("/api/subir", { method: "POST", body: fd });
        if (!r.ok) {
          throw new Error(
            r.status === 413 ? `archivo muy grande (máx ${MAX_SUBIDA_TEXTO})` : `servidor ${r.status}`,
          );
        }
      });
    } catch (err) {
      fallos.push(`${file.name}: ${err instanceof Error ? err.message : "error"}`);
    }
  }
  return fallos;
}
