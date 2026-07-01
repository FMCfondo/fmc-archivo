/** Filtros de búsqueda de expedientes — compartidos por el listado y el export CSV. */
import { eq, ilike, isNull, or, type SQL } from "drizzle-orm";
import { expedientes, type EstadoExpediente } from "@/db/schema";

export type ParametrosBusqueda = {
  q?: string | null;
  tipoId?: string | null;
  periodo?: string | null;
  estado?: string | null;
};

export function filtrosExpedientes(empresaId: string, p: ParametrosBusqueda): SQL[] {
  const conds: SQL[] = [eq(expedientes.empresaId, empresaId), isNull(expedientes.eliminadoEn)];
  if (p.tipoId) conds.push(eq(expedientes.tipoId, p.tipoId));
  if (p.periodo) conds.push(eq(expedientes.periodo, p.periodo));
  if (p.estado) conds.push(eq(expedientes.estado, p.estado as EstadoExpediente));
  if (p.q) {
    const like = `%${p.q}%`;
    conds.push(
      or(
        ilike(expedientes.consecutivo, like),
        ilike(expedientes.tercero, like),
        ilike(expedientes.concepto, like),
        ilike(expedientes.nitTercero, like),
      )!,
    );
  }
  return conds;
}
