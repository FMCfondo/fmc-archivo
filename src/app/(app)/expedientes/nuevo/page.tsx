import Link from "next/link";
import { requireEmpresaId } from "@/lib/session";
import { cargarTipos, construirArbol, aplanarArbol } from "@/lib/tipos";
import { crearExpediente } from "../actions";
import { CamposExpediente } from "../campos";

export default async function NuevoExpedientePage() {
  const { empresaId } = await requireEmpresaId();
  const tipos = await cargarTipos(empresaId, true);
  const opciones = aplanarArbol(construirArbol(tipos));

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Nuevo expediente</h1>
        <Link href="/expedientes" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← Volver
        </Link>
      </div>

      <form action={crearExpediente} className="space-y-6">
        <CamposExpediente opciones={opciones} />
        <div className="flex items-center gap-3">
          <button className="rounded-lg bg-neutral-900 px-5 py-2 text-sm font-medium text-white hover:bg-neutral-800">
            Crear expediente
          </button>
          <Link href="/expedientes" className="text-sm text-neutral-500 hover:text-neutral-900">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
