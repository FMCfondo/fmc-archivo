import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { expedientes } from "@/db/schema";
import { requireEmpresaId } from "@/lib/session";
import { cargarTipos, construirArbol, aplanarArbol } from "@/lib/tipos";
import { editarExpediente } from "../../actions";
import { CamposExpediente } from "../../campos";

export default async function EditarExpedientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { empresaId } = await requireEmpresaId();

  const exp = (
    await db
      .select()
      .from(expedientes)
      .where(and(eq(expedientes.id, id), eq(expedientes.empresaId, empresaId)))
      .limit(1)
  )[0];
  if (!exp) notFound();

  const tipos = await cargarTipos(empresaId, true);
  const opciones = aplanarArbol(construirArbol(tipos));

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Editar {exp.consecutivo ?? "expediente"}</h1>
        <Link
          href={`/expedientes/${exp.id}`}
          className="text-sm text-neutral-500 hover:text-neutral-900"
        >
          ← Volver
        </Link>
      </div>

      <form action={editarExpediente} className="space-y-6">
        <input type="hidden" name="id" value={exp.id} />
        <CamposExpediente
          opciones={opciones}
          exp={{
            tipoId: exp.tipoId,
            consecutivo: exp.consecutivo,
            periodo: exp.periodo,
            fecha: exp.fecha,
            tercero: exp.tercero,
            nitTercero: exp.nitTercero,
            valor: exp.valor,
            estado: exp.estado,
            concepto: exp.concepto,
            tieneCarpetaFisica: exp.tieneCarpetaFisica,
            rotuloCarpeta: exp.rotuloCarpeta,
            ubicacionFisica: exp.ubicacionFisica,
            folio: exp.folio,
            notas: exp.notas,
          }}
        />
        <div className="flex items-center gap-3">
          <button className="rounded-lg bg-neutral-900 px-5 py-2 text-sm font-medium text-white hover:bg-neutral-800">
            Guardar cambios
          </button>
          <Link
            href={`/expedientes/${exp.id}`}
            className="text-sm text-neutral-500 hover:text-neutral-900"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
