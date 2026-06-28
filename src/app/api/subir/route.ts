import { type NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { db } from "@/db";
import { consecutivos, documentos, expedientes } from "@/db/schema";
import { requireEmpresaId } from "@/lib/session";
import { cargarTipos, resolverSerie } from "@/lib/tipos";
import { r2, R2_BUCKET } from "@/lib/r2";

export const runtime = "nodejs";

type TipoSoporte =
  | "principal"
  | "factura"
  | "soporte_pago"
  | "registro_contable"
  | "comprobante_bancario"
  | "otro";

async function crearExpedienteEnCarpeta(
  empresaId: string,
  userId: string,
  tipoId: string,
  nombre: string,
) {
  const tipos = await cargarTipos(empresaId);
  const serie = resolverSerie(tipos, tipoId);
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
  const [exp] = await db
    .insert(expedientes)
    .values({ empresaId, tipoId, consecutivo, numero, concepto: nombre, creadoPor: userId })
    .returning({ id: expedientes.id });
  return exp.id;
}

export async function POST(req: NextRequest) {
  const { session, empresaId } = await requireEmpresaId();
  const form = await req.formData();

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No se recibió el archivo." }, { status: 400 });
  }

  const tipoId = form.get("tipoId");
  const expedienteIdForm = form.get("expedienteId");
  const tipoSoporte = ((form.get("tipoSoporte") as string) || "otro") as TipoSoporte;

  let expedienteId: string;
  if (typeof tipoId === "string" && tipoId) {
    const nombre = file.name.replace(/\.[^.]+$/, "");
    expedienteId = await crearExpedienteEnCarpeta(empresaId, session.user.id, tipoId, nombre);
  } else if (typeof expedienteIdForm === "string" && expedienteIdForm) {
    const exp = (
      await db
        .select({ id: expedientes.id })
        .from(expedientes)
        .where(and(eq(expedientes.id, expedienteIdForm), eq(expedientes.empresaId, empresaId)))
        .limit(1)
    )[0];
    if (!exp) return NextResponse.json({ error: "Expediente no encontrado." }, { status: 404 });
    expedienteId = expedienteIdForm;
  } else {
    return NextResponse.json({ error: "Falta el destino del archivo." }, { status: 400 });
  }

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const key = `${empresaId}/${crypto.randomUUID()}.${ext}`;
  const contentType = file.type || "application/octet-stream";
  const bytes = new Uint8Array(await file.arrayBuffer());

  await r2.send(
    new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: bytes, ContentType: contentType }),
  );

  await db.insert(documentos).values({
    expedienteId,
    empresaId,
    tipoSoporte: typeof tipoId === "string" && tipoId ? "principal" : tipoSoporte,
    nombreArchivo: file.name,
    r2Key: key,
    mime: contentType,
    tamano: file.size,
    subidoPor: session.user.id,
  });

  return NextResponse.json({ ok: true, expedienteId });
}
