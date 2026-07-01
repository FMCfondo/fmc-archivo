import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { tiposDocumento, expedientes, documentos } from "@/db/schema";
import { requireEmpresaId } from "@/lib/session";
import { cargarTipos, rutaTipo, opcionesConRuta } from "@/lib/tipos";
import { crearCarpeta } from "../actions";
import { SubirDocumento } from "../subir-documento";
import { FilaDocumento } from "../fila-documento";

const th = "px-3 py-2 font-medium";

export default async function CarpetaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { empresaId } = await requireEmpresaId();

  const tipos = await cargarTipos(empresaId);
  const carpeta = tipos.find((t) => t.id === id);
  if (!carpeta) notFound();

  const activos = tipos.filter((t) => t.activo);
  const subcarpetas = activos.filter((t) => t.parentId === id);
  const opciones = opcionesConRuta(activos);
  const ruta = rutaTipo(tipos, id);
  const volverHref = carpeta.parentId ? `/carpetas/${carpeta.parentId}` : "/carpetas";

  const exps = await db
    .select()
    .from(expedientes)
    .where(
      and(eq(expedientes.tipoId, id), eq(expedientes.empresaId, empresaId), isNull(expedientes.eliminadoEn)),
    )
    .orderBy(asc(expedientes.creadoEn));

  const ids = exps.map((e) => e.id);
  const docs = ids.length
    ? await db
        .select()
        .from(documentos)
        .where(
          and(
            eq(documentos.empresaId, empresaId),
            inArray(documentos.expedienteId, ids),
            isNull(documentos.eliminadoEn),
          ),
        )
    : [];
  const soportesDe = (eid: string) =>
    docs
      .filter((d) => d.expedienteId === eid && d.tipoSoporte !== "principal")
      .map((d) => ({ id: d.id, nombre: d.nombreArchivo }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={volverHref} className="text-sm text-neutral-500 hover:text-neutral-900">
            ← Volver
          </Link>
          <h1 className="mt-1 text-lg font-semibold">{ruta}</h1>
        </div>
        <SubirDocumento tipoId={id} />
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-neutral-500">Subcarpetas</h2>
        <div className="flex flex-wrap items-center gap-2">
          {subcarpetas.map((s) => (
            <Link
              key={s.id}
              href={`/carpetas/${s.id}`}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
            >
              {s.nombre}
            </Link>
          ))}
          <form action={crearCarpeta} className="flex items-center gap-1">
            <input type="hidden" name="parentId" value={id} />
            <input
              name="nombre"
              required
              placeholder="nueva subcarpeta"
              className="rounded border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-neutral-900"
            />
            <button className="rounded-lg border border-dashed border-neutral-300 px-2 py-1.5 text-sm text-neutral-500 hover:bg-neutral-50">
              + Subcarpeta
            </button>
          </form>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-500">
            <tr>
              <th className={th}>Nombre del documento</th>
              <th className={th}>Tipo (carpeta)</th>
              <th className={th}>Soportes</th>
              <th className={th}>Carpeta física</th>
              <th className={th}>Imprimir / descargar</th>
              <th className={th}></th>
            </tr>
          </thead>
          <tbody>
            {exps.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-neutral-400">
                  No hay documentos en esta carpeta. Usa “Subir documento”.
                </td>
              </tr>
            )}
            {exps.map((e) => (
              <FilaDocumento
                key={e.id}
                carpetaActual={id}
                opciones={opciones}
                doc={{
                  id: e.id,
                  nombre: e.concepto ?? e.consecutivo ?? "Documento",
                  tipoId: e.tipoId,
                  tieneCF: e.tieneCarpetaFisica,
                  rotulo: e.rotuloCarpeta ?? "",
                  ubicacion: e.ubicacionFisica ?? "",
                  soportes: soportesDe(e.id),
                }}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
