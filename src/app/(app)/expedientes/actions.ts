"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { consecutivos, documentos, expedientes } from "@/db/schema";
import { requireEmpresaId } from "@/lib/session";
import { cargarTipos, resolverSerie } from "@/lib/tipos";
import { urlSubida, urlDescarga, eliminarObjeto } from "@/lib/r2";

type TipoSoporte =
  | "principal"
  | "factura"
  | "soporte_pago"
  | "registro_contable"
  | "comprobante_bancario"
  | "otro";
type EstadoExpediente = "pendiente" | "completo" | "fusionado";

function str(v: FormDataEntryValue | null): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : null;
}

/** Genera/aplica el consecutivo de la serie del tipo, respetando un override. */
async function resolverConsecutivo(
  empresaId: string,
  tipoId: string,
  override: string | null,
): Promise<{ consecutivo: string; numero: number | null }> {
  const tipos = await cargarTipos(empresaId);
  const serie = resolverSerie(tipos, tipoId);

  if (override) {
    const m = override.match(/(\d+)\s*$/);
    const numero = m ? parseInt(m[1], 10) : null;
    if (numero != null) {
      // mantiene el contador al día sin retroceder
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

function leerCampos(formData: FormData) {
  return {
    periodo: str(formData.get("periodo")),
    fecha: str(formData.get("fecha")),
    tercero: str(formData.get("tercero")),
    nitTercero: str(formData.get("nitTercero")),
    concepto: str(formData.get("concepto")),
    valor: str(formData.get("valor")),
    estado: (str(formData.get("estado")) ?? "pendiente") as EstadoExpediente,
    tieneCarpetaFisica: formData.get("tieneCarpetaFisica") === "on",
    rotuloCarpeta: str(formData.get("rotuloCarpeta")),
    ubicacionFisica: str(formData.get("ubicacionFisica")),
    folio: str(formData.get("folio")),
    notas: str(formData.get("notas")),
  };
}

/** Crea un expediente (consecutivo automático o el que indique el usuario). */
export async function crearExpediente(formData: FormData) {
  const { session, empresaId } = await requireEmpresaId();
  const tipoId = str(formData.get("tipoId"));
  if (!tipoId) throw new Error("Selecciona un tipo de documento.");

  const { consecutivo, numero } = await resolverConsecutivo(
    empresaId,
    tipoId,
    str(formData.get("consecutivo")),
  );

  const [exp] = await db
    .insert(expedientes)
    .values({
      empresaId,
      tipoId,
      consecutivo,
      numero,
      ...leerCampos(formData),
      creadoPor: session.user.id,
    })
    .returning({ id: expedientes.id });

  revalidatePath("/expedientes");
  redirect(`/expedientes/${exp.id}`);
}

/** Edita los datos de un expediente (incluido el consecutivo). */
export async function editarExpediente(formData: FormData) {
  const { empresaId } = await requireEmpresaId();
  const id = str(formData.get("id"));
  if (!id) throw new Error("Falta el identificador del expediente.");
  const tipoId = str(formData.get("tipoId"));

  await db
    .update(expedientes)
    .set({
      ...(tipoId ? { tipoId } : {}),
      consecutivo: str(formData.get("consecutivo")),
      ...leerCampos(formData),
      actualizadoEn: new Date(),
    })
    .where(and(eq(expedientes.id, id), eq(expedientes.empresaId, empresaId)));

  revalidatePath(`/expedientes/${id}`);
  redirect(`/expedientes/${id}`);
}

/** Elimina un expediente y todos sus documentos (también de R2). */
export async function eliminarExpediente(formData: FormData) {
  const { empresaId } = await requireEmpresaId();
  const id = str(formData.get("id"));
  if (!id) return;

  const docs = await db
    .select({ r2Key: documentos.r2Key })
    .from(documentos)
    .where(and(eq(documentos.expedienteId, id), eq(documentos.empresaId, empresaId)));
  for (const d of docs) {
    try {
      await eliminarObjeto(d.r2Key);
    } catch {
      // continúa aunque falle el borrado de un archivo
    }
  }

  await db.delete(expedientes).where(and(eq(expedientes.id, id), eq(expedientes.empresaId, empresaId)));
  revalidatePath("/expedientes");
  redirect("/expedientes");
}

/** URL prefirmada para subir un archivo directo a R2. */
export async function generarUrlSubida(nombreArchivo: string, contentType: string) {
  const { empresaId } = await requireEmpresaId();
  const partes = nombreArchivo.split(".");
  const ext = partes.length > 1 ? partes.pop() : "bin";
  const key = `${empresaId}/${crypto.randomUUID()}.${ext}`;
  const url = await urlSubida(key, contentType);
  return { url, key };
}

/** Registra en la BD un documento ya subido a R2. */
export async function registrarDocumento(input: {
  expedienteId: string;
  r2Key: string;
  nombreArchivo: string;
  mime: string;
  tamano: number;
  tipoSoporte: TipoSoporte;
}) {
  const { session, empresaId } = await requireEmpresaId();
  const exp = (
    await db
      .select({ id: expedientes.id })
      .from(expedientes)
      .where(and(eq(expedientes.id, input.expedienteId), eq(expedientes.empresaId, empresaId)))
      .limit(1)
  )[0];
  if (!exp) throw new Error("Expediente no encontrado.");

  await db.insert(documentos).values({
    expedienteId: input.expedienteId,
    empresaId,
    tipoSoporte: input.tipoSoporte,
    nombreArchivo: input.nombreArchivo,
    r2Key: input.r2Key,
    mime: input.mime,
    tamano: input.tamano,
    subidoPor: session.user.id,
  });
  revalidatePath(`/expedientes/${input.expedienteId}`);
}

/** URL prefirmada para abrir/descargar un documento. */
export async function obtenerUrlDescarga(documentoId: string) {
  const { empresaId } = await requireEmpresaId();
  const doc = (
    await db
      .select({ r2Key: documentos.r2Key })
      .from(documentos)
      .where(and(eq(documentos.id, documentoId), eq(documentos.empresaId, empresaId)))
      .limit(1)
  )[0];
  if (!doc) throw new Error("Documento no encontrado.");
  return urlDescarga(doc.r2Key);
}

/** Elimina un documento (de R2 y de la BD). */
export async function eliminarDocumento(documentoId: string) {
  const { empresaId } = await requireEmpresaId();
  const doc = (
    await db
      .select({ r2Key: documentos.r2Key, expedienteId: documentos.expedienteId })
      .from(documentos)
      .where(and(eq(documentos.id, documentoId), eq(documentos.empresaId, empresaId)))
      .limit(1)
  )[0];
  if (!doc) return;

  try {
    await eliminarObjeto(doc.r2Key);
  } catch {
    // igual quitamos el registro
  }
  await db.delete(documentos).where(eq(documentos.id, documentoId));
  revalidatePath(`/expedientes/${doc.expedienteId}`);
}
