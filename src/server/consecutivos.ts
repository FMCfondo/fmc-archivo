/**
 * Consecutivos por serie contable — ÚNICA implementación.
 * La serie de un tipo se hereda de la primera carpeta ancestro con prefijo+libro
 * (ej. EGRESOS: CC-10-x); si ninguna la define, se numera con el código del propio tipo.
 */
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { consecutivos } from "@/db/schema";
import { cargarTipos, type Tipo } from "@/lib/tipos";

export type Serie = {
  ownerId: string;
  prefijo: string | null;
  libro: string | null;
  codigo: string;
};

/** Sube por los padres hasta encontrar el primero con prefijo+libro (serie compartida). */
export function resolverSerie(tipos: Tipo[], tipoId: string): Serie {
  const map = new Map(tipos.map((t) => [t.id, t] as const));
  const original = map.get(tipoId);
  let actual = original;
  while (actual) {
    if (actual.prefijo && actual.libro) {
      return {
        ownerId: actual.id,
        prefijo: actual.prefijo,
        libro: actual.libro,
        codigo: actual.codigo,
      };
    }
    actual = actual.parentId ? map.get(actual.parentId) : undefined;
  }
  return {
    ownerId: original?.id ?? tipoId,
    prefijo: null,
    libro: null,
    codigo: original?.codigo ?? "",
  };
}

/**
 * Asigna el siguiente consecutivo de la serie del tipo.
 * Con `override`, respeta el valor manual y ajusta el contador sin retroceder
 * (permite corregir numeraciones sin romper la secuencia).
 */
export async function asignarConsecutivo(
  empresaId: string,
  tipoId: string,
  override?: string | null,
): Promise<{ consecutivo: string; numero: number | null }> {
  const tipos = await cargarTipos(empresaId);
  const serie = resolverSerie(tipos, tipoId);

  if (override) {
    const m = override.match(/(\d+)\s*$/);
    const numero = m ? parseInt(m[1], 10) : null;
    if (numero != null) {
      await db
        .insert(consecutivos)
        .values({ empresaId, tipoId: serie.ownerId, ultimo: numero })
        .onConflictDoUpdate({
          target: [consecutivos.empresaId, consecutivos.tipoId],
          set: { ultimo: sql`greatest(${consecutivos.ultimo}, ${numero})` },
        });
    }
    return { consecutivo: override, numero };
  }

  const [c] = await db
    .insert(consecutivos)
    .values({ empresaId, tipoId: serie.ownerId, ultimo: 1 })
    .onConflictDoUpdate({
      target: [consecutivos.empresaId, consecutivos.tipoId],
      set: { ultimo: sql`${consecutivos.ultimo} + 1` },
    })
    .returning({ ultimo: consecutivos.ultimo });

  const numero = c.ultimo;
  const consecutivo =
    serie.prefijo && serie.libro
      ? `${serie.prefijo}-${serie.libro}-${numero}`
      : `${serie.codigo}-${numero}`;
  return { consecutivo, numero };
}
