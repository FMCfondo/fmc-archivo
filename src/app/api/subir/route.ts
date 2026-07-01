import { type NextRequest, NextResponse } from "next/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { db } from "@/db";
import { consecutivos, documentos, expedientes } from "@/db/schema";
import { requireEmpresaId } from "@/lib/session";
import { cargarTipos, resolverSerie } from "@/lib/tipos";
import { r2, R2_BUCKET } from "@/lib/r2";
import { registrarBitacora } from "@/lib/bitacora";
import { detectarTipoReal } from "@/lib/validar-archivo";
import { subirArchivoSchema } from "@/lib/validacion";

export const runtime = "nodejs";

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

  await registrarBitacora({
    empresaId,
    usuarioId: userId,
    accion: "crear",
    entidad: "expediente",
    entidadId: exp.id,
  });
  return exp.id;
}

export async function POST(req: NextRequest) {
  const { session, empresaId } = await requireEmpresaId();
  const form = await req.formData();

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No se recibió el archivo." }, { status: 400 });
  }

  const entrada = subirArchivoSchema.safeParse({
    tipoId: form.get("tipoId") || undefined,
    expedienteId: form.get("expedienteId") || undefined,
    tipoSoporte: form.get("tipoSoporte") || undefined,
  });
  if (!entrada.success) {
    return NextResponse.json({ error: "Datos de la solicitud inválidos." }, { status: 400 });
  }
  const { tipoId, expedienteId: expedienteIdForm, tipoSoporte } = entrada.data;

  // Valida el contenido REAL del archivo (magic bytes), no lo que diga el navegador.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeReal = detectarTipoReal(bytes);
  if (!mimeReal) {
    return NextResponse.json(
      { error: "Solo se permiten archivos PDF, JPG o PNG (el contenido no coincide)." },
      { status: 400 },
    );
  }

  let expedienteId: string;
  if (tipoId) {
    const nombre = file.name.replace(/\.[^.]+$/, "");
    expedienteId = await crearExpedienteEnCarpeta(empresaId, session.user.id, tipoId, nombre);
  } else if (expedienteIdForm) {
    const exp = (
      await db
        .select({ id: expedientes.id })
        .from(expedientes)
        .where(
          and(
            eq(expedientes.id, expedienteIdForm),
            eq(expedientes.empresaId, empresaId),
            isNull(expedientes.eliminadoEn),
          ),
        )
        .limit(1)
    )[0];
    if (!exp) return NextResponse.json({ error: "Expediente no encontrado." }, { status: 404 });
    expedienteId = expedienteIdForm;
  } else {
    return NextResponse.json({ error: "Falta el destino del archivo." }, { status: 400 });
  }

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const key = `${empresaId}/${crypto.randomUUID()}.${ext}`;

  await r2.send(
    new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: bytes, ContentType: mimeReal }),
  );

  const [doc] = await db
    .insert(documentos)
    .values({
      expedienteId,
      empresaId,
      tipoSoporte: tipoId ? "principal" : (tipoSoporte ?? "otro"),
      nombreArchivo: file.name,
      r2Key: key,
      mime: mimeReal,
      tamano: file.size,
      subidoPor: session.user.id,
    })
    .returning({ id: documentos.id });

  await registrarBitacora({
    empresaId,
    usuarioId: session.user.id,
    accion: "subir_documento",
    entidad: "documento",
    entidadId: doc.id,
    detalle: file.name,
  });

  return NextResponse.json({ ok: true, expedienteId });
}
