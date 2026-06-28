import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { expedientes, tiposDocumento, documentos } from "@/db/schema";
import { requireEmpresaId } from "@/lib/session";
import { formatCOP, ETIQUETAS_ESTADO } from "@/lib/format";
import { Uploader } from "./uploader";
import { DocumentoFila } from "./documento-fila";
import { EliminarExpedienteBtn } from "./eliminar-btn";

function Dato({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-neutral-400">{etiqueta}</dt>
      <dd className="text-sm text-neutral-800">{valor || "—"}</dd>
    </div>
  );
}

export default async function DetalleExpedientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { empresaId } = await requireEmpresaId();

  const exp = (
    await db
      .select({
        id: expedientes.id,
        consecutivo: expedientes.consecutivo,
        periodo: expedientes.periodo,
        fecha: expedientes.fecha,
        tercero: expedientes.tercero,
        nitTercero: expedientes.nitTercero,
        concepto: expedientes.concepto,
        valor: expedientes.valor,
        estado: expedientes.estado,
        tieneCarpetaFisica: expedientes.tieneCarpetaFisica,
        rotuloCarpeta: expedientes.rotuloCarpeta,
        ubicacionFisica: expedientes.ubicacionFisica,
        folio: expedientes.folio,
        notas: expedientes.notas,
        creadoEn: expedientes.creadoEn,
        tipoNombre: tiposDocumento.nombre,
        tipoCodigo: tiposDocumento.codigo,
      })
      .from(expedientes)
      .innerJoin(tiposDocumento, eq(expedientes.tipoId, tiposDocumento.id))
      .where(and(eq(expedientes.id, id), eq(expedientes.empresaId, empresaId)))
      .limit(1)
  )[0];

  if (!exp) notFound();

  const docs = await db
    .select()
    .from(documentos)
    .where(eq(documentos.expedienteId, id))
    .orderBy(asc(documentos.subidoEn));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/expedientes" className="text-sm text-neutral-500 hover:text-neutral-900">
            ← Expedientes
          </Link>
          <h1 className="mt-1 text-lg font-semibold">{exp.consecutivo ?? "Expediente"}</h1>
          <p className="text-sm text-neutral-500">
            {exp.tipoCodigo} · {exp.tipoNombre}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">
            {ETIQUETAS_ESTADO[exp.estado] ?? exp.estado}
          </span>
          <Link
            href={`/expedientes/${exp.id}/editar`}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
          >
            Editar
          </Link>
          <EliminarExpedienteBtn id={exp.id} />
        </div>
      </div>

      {/* Datos */}
      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-neutral-500">Datos del expediente</h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Dato etiqueta="Periodo" valor={exp.periodo} />
          <Dato etiqueta="Fecha" valor={exp.fecha} />
          <Dato etiqueta="Valor" valor={formatCOP(exp.valor)} />
          <Dato etiqueta="Tercero" valor={exp.tercero} />
          <Dato etiqueta="NIT / Cédula" valor={exp.nitTercero} />
          <Dato etiqueta="Concepto" valor={exp.concepto} />
        </dl>
        {exp.notas && (
          <div className="mt-4 border-t border-neutral-100 pt-4">
            <Dato etiqueta="Notas" valor={exp.notas} />
          </div>
        )}
      </section>

      {/* Carpeta física */}
      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-neutral-500">Carpeta física</h2>
        {exp.tieneCarpetaFisica ? (
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Dato etiqueta="Rótulo" valor={exp.rotuloCarpeta} />
            <Dato etiqueta="Ubicación" valor={exp.ubicacionFisica} />
            <Dato etiqueta="Folio" valor={exp.folio} />
          </dl>
        ) : (
          <p className="text-sm text-neutral-400">Sin carpeta física registrada.</p>
        )}
      </section>

      {/* Documentos */}
      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-neutral-500">
            Documentos y soportes ({docs.length})
          </h2>
          {docs.length > 0 && (
            <div className="flex items-center gap-2">
              <a
                href={`/expedientes/${exp.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800"
              >
                Ver unido (PDF)
              </a>
              <a
                href={`/expedientes/${exp.id}/pdf?dl=1`}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
              >
                Descargar
              </a>
            </div>
          )}
        </div>

        <Uploader expedienteId={exp.id} />

        <div className="mt-4 divide-y divide-neutral-100">
          {docs.length === 0 && (
            <p className="py-6 text-center text-sm text-neutral-400">
              Aún no hay documentos. Sube el PDF principal y sus soportes arriba.
            </p>
          )}
          {docs.map((d) => (
            <DocumentoFila
              key={d.id}
              doc={{
                id: d.id,
                nombreArchivo: d.nombreArchivo,
                tipoSoporte: d.tipoSoporte,
                tamano: d.tamano,
              }}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
