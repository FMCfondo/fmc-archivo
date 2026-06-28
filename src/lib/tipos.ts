import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { tiposDocumento } from "@/db/schema";

export type Tipo = typeof tiposDocumento.$inferSelect;
export type TipoNodo = Tipo & { hijos: TipoNodo[]; nivel: number };

export async function cargarTipos(empresaId: string, soloActivos = false): Promise<Tipo[]> {
  const where = soloActivos
    ? and(eq(tiposDocumento.empresaId, empresaId), eq(tiposDocumento.activo, true))
    : eq(tiposDocumento.empresaId, empresaId);
  return db.select().from(tiposDocumento).where(where).orderBy(tiposDocumento.orden);
}

/** Convierte la lista plana en árbol (con nivel calculado). */
export function construirArbol(tipos: Tipo[]): TipoNodo[] {
  const map = new Map<string, TipoNodo>();
  for (const t of tipos) map.set(t.id, { ...t, hijos: [], nivel: 0 });
  const raices: TipoNodo[] = [];
  for (const t of tipos) {
    const nodo = map.get(t.id)!;
    const padre = t.parentId ? map.get(t.parentId) : undefined;
    if (padre) padre.hijos.push(nodo);
    else raices.push(nodo);
  }
  const setNivel = (nodos: TipoNodo[], nivel: number) => {
    for (const n of nodos) {
      n.nivel = nivel;
      setNivel(n.hijos, nivel + 1);
    }
  };
  setNivel(raices, 0);
  return raices;
}

/** Aplana el árbol a una lista en orden de despliegue (para <select>). */
export function aplanarArbol(raices: TipoNodo[]): TipoNodo[] {
  const out: TipoNodo[] = [];
  const walk = (nodos: TipoNodo[]) => {
    for (const n of nodos) {
      out.push(n);
      walk(n.hijos);
    }
  };
  walk(raices);
  return out;
}

/**
 * Resuelve la "serie" del consecutivo: sube por los padres hasta encontrar el
 * primero con prefijo+libro (serie compartida). Si ninguno tiene, la serie es
 * el propio tipo y se numera con su código.
 */
export function resolverSerie(
  tipos: Tipo[],
  tipoId: string,
): { ownerId: string; prefijo: string | null; libro: string | null; codigo: string } {
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
  return { ownerId: original?.id ?? tipoId, prefijo: null, libro: null, codigo: original?.codigo ?? "" };
}

/** Ruta completa de una carpeta: "Egresos / Nómina / Quincenal". */
export function rutaTipo(tipos: Tipo[], id: string): string {
  const map = new Map(tipos.map((t) => [t.id, t] as const));
  const partes: string[] = [];
  let cur = map.get(id);
  let guard = 0;
  while (cur && guard++ < 20) {
    partes.unshift(cur.nombre);
    cur = cur.parentId ? map.get(cur.parentId) : undefined;
  }
  return partes.join(" / ");
}

/** Lista de carpetas con su ruta completa, ordenada, para usar en un <select>. */
export function opcionesConRuta(tipos: Tipo[]): { id: string; ruta: string }[] {
  return tipos
    .map((t) => ({ id: t.id, ruta: rutaTipo(tipos, t.id) }))
    .sort((a, b) => a.ruta.localeCompare(b.ruta, "es"));
}
