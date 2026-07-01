/** Casos de uso sobre carpetas (tabla `tipos_documento`) — creación unificada con bitácora. */
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { tiposDocumento } from "@/db/schema";
import { registrarBitacora } from "@/lib/bitacora";

/**
 * Crea una carpeta/tipo de documento al final del orden, siempre con bitácora.
 * Si no se da código, se autogenera uno único (las pantallas contables pueden exigirlo).
 */
export async function crearTipoDocumento(input: {
  empresaId: string;
  usuarioId: string;
  nombre: string;
  codigo?: string | null;
  prefijo?: string | null;
  libro?: string | null;
  parentId?: string | null;
}): Promise<string> {
  const [{ maxOrden }] = await db
    .select({ maxOrden: sql<number>`coalesce(max(${tiposDocumento.orden}), 0)` })
    .from(tiposDocumento)
    .where(eq(tiposDocumento.empresaId, input.empresaId));

  const [tipo] = await db
    .insert(tiposDocumento)
    .values({
      empresaId: input.empresaId,
      codigo: input.codigo ?? `C-${Date.now().toString(36)}`,
      nombre: input.nombre,
      prefijo: input.prefijo ?? null,
      libro: input.libro ?? null,
      parentId: input.parentId ?? null,
      orden: (Number(maxOrden) || 0) + 1,
    })
    .returning({ id: tiposDocumento.id });

  await registrarBitacora({
    empresaId: input.empresaId,
    usuarioId: input.usuarioId,
    accion: "crear",
    entidad: "tipo_documento",
    entidadId: tipo.id,
    detalle: input.nombre,
  });

  return tipo.id;
}
