import { type NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { requireEmpresaId } from "@/lib/session";
import { r2, R2_BUCKET, eliminarObjeto } from "@/lib/r2";
import { detectarTipoReal } from "@/lib/validar-archivo";
import { subirArchivoSchema } from "@/lib/validacion";
import { MAX_SUBIDA_BYTES, MAX_SUBIDA_TEXTO } from "@/lib/constantes";
import { crearExpedienteNuevo } from "@/server/expedientes";
import { registrarSoporte } from "@/server/documentos";

export const runtime = "nodejs";

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

  const bytes = new Uint8Array(await file.arrayBuffer());
  // Límite propio (no solo el implícito de la plataforma), con respuesta 413 clara.
  if (bytes.length > MAX_SUBIDA_BYTES) {
    return NextResponse.json(
      { error: `El archivo supera el máximo de ${MAX_SUBIDA_TEXTO}.` },
      { status: 413 },
    );
  }
  // Valida el contenido REAL del archivo (magic bytes), no lo que diga el navegador.
  const mimeReal = detectarTipoReal(bytes);
  if (!mimeReal) {
    return NextResponse.json(
      { error: "Solo se permiten archivos PDF, JPG o PNG (el contenido no coincide)." },
      { status: 400 },
    );
  }

  let expedienteId: string;
  if (tipoId) {
    // Crea el documento (expediente) en la carpeta, con su consecutivo y bitácora.
    expedienteId = await crearExpedienteNuevo({
      empresaId,
      usuarioId: session.user.id,
      tipoId,
      campos: { concepto: file.name.replace(/\.[^.]+$/, "") },
    });
  } else if (expedienteIdForm) {
    expedienteId = expedienteIdForm; // registrarSoporte valida que exista, sea de la empresa y esté vivo
  } else {
    return NextResponse.json({ error: "Falta el destino del archivo." }, { status: 400 });
  }

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const key = `${empresaId}/${crypto.randomUUID()}.${ext}`;

  await r2.send(
    new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: bytes, ContentType: mimeReal }),
  );

  try {
    await registrarSoporte({
      empresaId,
      usuarioId: session.user.id,
      expedienteId,
      tipoSoporte: tipoId ? "principal" : (tipoSoporte ?? "otro"),
      nombreArchivo: file.name,
      r2Key: key,
      mime: mimeReal,
      tamano: file.size,
    });
  } catch (err) {
    // Compensación: si el registro en BD falla, no dejamos el archivo huérfano en R2.
    try {
      await eliminarObjeto(key);
    } catch {
      // el objeto huérfano se reporta pero no bloquea la respuesta de error
      console.error("No se pudo limpiar el objeto huérfano de R2:", key);
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo registrar el archivo." },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, expedienteId });
}
