import Link from "next/link";
import { requireEmpresaId } from "@/lib/session";
import { cargarTipos } from "@/lib/tipos";
import { INPUT_INLINE, BTN_PRIMARIO } from "@/components/ui";
import { crearCarpeta } from "./actions";

const inp = INPUT_INLINE;

export default async function CarpetasPage() {
  const { empresaId } = await requireEmpresaId();
  const carpetas = (await cargarTipos(empresaId, true)).filter((t) => !t.parentId);

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold">Carpetas</h1>

      <form
        action={crearCarpeta}
        className="flex flex-wrap items-end gap-2 rounded-xl border border-neutral-200 bg-white p-4"
      >
        <input name="nombre" required placeholder="Nombre de la carpeta (ej. Egresos)" className={`${inp} flex-1`} />
        <button className={BTN_PRIMARIO}>+ Nueva carpeta</button>
      </form>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        {carpetas.length === 0 && (
          <p className="px-4 py-10 text-center text-neutral-400">
            Aún no tienes carpetas. Crea la primera arriba.
          </p>
        )}
        {carpetas.map((c) => (
          <Link
            key={c.id}
            href={`/carpetas/${c.id}`}
            className="flex items-center justify-between border-b border-neutral-100 px-4 py-3 last:border-b-0 hover:bg-neutral-50"
          >
            <span className="font-medium text-neutral-800">{c.nombre}</span>
            <span className="text-neutral-400">›</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
