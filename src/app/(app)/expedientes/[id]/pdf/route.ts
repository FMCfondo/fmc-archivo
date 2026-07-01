import { type NextRequest } from "next/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";
import { db } from "@/db";
import { documentos, expedientes } from "@/db/schema";
import { requireEmpresaId } from "@/lib/session";
import { obtenerBytes } from "@/lib/r2";

export const runtime = "nodejs";

// El documento principal va primero; el resto, en orden de subida.
const ordenPrincipal = (t: string) => (t === "principal" ? 0 : 1);

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { empresaId } = await requireEmpresaId();

  const exp = (
    await db
      .select({ id: expedientes.id, consecutivo: expedientes.consecutivo })
      .from(expedientes)
      .where(
        and(eq(expedientes.id, id), eq(expedientes.empresaId, empresaId), isNull(expedientes.eliminadoEn)),
      )
      .limit(1)
  )[0];
  if (!exp) return new Response("Expediente no encontrado.", { status: 404 });

  const docs = await db
    .select()
    .from(documentos)
    .where(
      and(
        eq(documentos.expedienteId, id),
        eq(documentos.empresaId, empresaId),
        isNull(documentos.eliminadoEn),
      ),
    )
    .orderBy(asc(documentos.subidoEn));

  if (docs.length === 0) {
    return new Response("Este expediente todavía no tiene documentos.", { status: 404 });
  }
  docs.sort((a, b) => ordenPrincipal(a.tipoSoporte) - ordenPrincipal(b.tipoSoporte));

  const merged = await PDFDocument.create();
  for (const d of docs) {
    try {
      const bytes = await obtenerBytes(d.r2Key);
      const nombre = d.nombreArchivo.toLowerCase();
      const mime = (d.mime ?? "").toLowerCase();

      if (mime.includes("pdf") || nombre.endsWith(".pdf")) {
        const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const pages = await merged.copyPages(src, src.getPageIndices());
        pages.forEach((p) => merged.addPage(p));
      } else if (mime.includes("png") || nombre.endsWith(".png")) {
        const img = await merged.embedPng(bytes);
        const page = merged.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      } else if (mime.includes("jpeg") || mime.includes("jpg") || /\.jpe?g$/.test(nombre)) {
        const img = await merged.embedJpg(bytes);
        const page = merged.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      }
      // otros formatos se omiten del PDF unido
    } catch {
      // si un archivo falla (corrupto/encriptado), se omite y seguimos
    }
  }

  if (merged.getPageCount() === 0) {
    return new Response("No se pudieron unir los documentos (formatos no soportados).", {
      status: 422,
    });
  }

  const bytes = await merged.save();
  const descargar = req.nextUrl.searchParams.get("dl");
  const filename = `${exp.consecutivo ?? "expediente"}.pdf`.replace(/[^\w.\-]+/g, "_");

  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${descargar ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
