import { requireEmpresaId } from "@/lib/session";
import { cargarTipos, construirArbol, type TipoNodo } from "@/lib/tipos";
import { INPUT_SM } from "@/components/ui";
import { crearCategoria, crearSubcategoria, actualizarTipo, toggleActivo } from "./actions";

const inp = INPUT_SM;

function Nodo({ nodo }: { nodo: TipoNodo }) {
  return (
    <div className={nodo.nivel === 0 ? "rounded-xl border border-neutral-200 bg-white p-4" : "mt-2"}>
      <div className={`flex flex-wrap items-center gap-2 ${nodo.activo ? "" : "opacity-50"}`}>
        <form action={actualizarTipo} className="flex flex-1 flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={nodo.id} />
          <input name="codigo" defaultValue={nodo.codigo} className={`${inp} w-24`} />
          <input name="nombre" defaultValue={nodo.nombre} className={`${inp} min-w-40 flex-1`} />
          <input
            name="prefijo"
            defaultValue={nodo.prefijo ?? ""}
            placeholder="prefijo"
            className={`${inp} w-20`}
          />
          <input
            name="libro"
            defaultValue={nodo.libro ?? ""}
            placeholder="libro"
            className={`${inp} w-16`}
          />
          <button className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100">
            Guardar
          </button>
        </form>
        <form action={toggleActivo}>
          <input type="hidden" name="id" value={nodo.id} />
          <button className="rounded-lg border border-neutral-300 px-2 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100">
            {nodo.activo ? "Desactivar" : "Activar"}
          </button>
        </form>
      </div>

      <div className="ml-3 border-l-2 border-neutral-100 pl-3">
        {nodo.hijos.map((h) => (
          <Nodo key={h.id} nodo={h} />
        ))}
        <form action={crearSubcategoria} className="flex flex-wrap items-center gap-2 pt-2">
          <input type="hidden" name="parentId" value={nodo.id} />
          <input name="codigo" placeholder="código" required className={`${inp} w-24`} />
          <input
            name="nombre"
            placeholder="nueva subcategoría"
            required
            className={`${inp} min-w-40 flex-1`}
          />
          <button className="rounded-lg border border-dashed border-neutral-300 px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-50">
            + Sub
          </button>
        </form>
      </div>
    </div>
  );
}

export default async function CatalogoPage() {
  const { empresaId } = await requireEmpresaId();
  const tipos = await cargarTipos(empresaId);
  const arbol = construirArbol(tipos);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Catálogo de categorías</h1>
        <p className="text-sm text-neutral-500">
          Crea, renombra, anida o desactiva categorías (con subniveles ilimitados). El prefijo y
          libro definen la serie del consecutivo (ej. CC + 10 → CC-10-1); las subcategorías heredan
          la serie de su categoría madre.
        </p>
      </div>

      {/* Nueva categoría raíz */}
      <form
        action={crearCategoria}
        className="flex flex-wrap items-end gap-2 rounded-xl border border-neutral-200 bg-white p-4"
      >
        <div className="flex flex-col">
          <label className="mb-1 text-xs text-neutral-500">Código</label>
          <input name="codigo" required placeholder="33" className={`${inp} w-20`} />
        </div>
        <div className="flex flex-1 flex-col">
          <label className="mb-1 text-xs text-neutral-500">Nombre de la categoría</label>
          <input name="nombre" required placeholder="NUEVA CATEGORÍA" className={`${inp} w-full`} />
        </div>
        <div className="flex flex-col">
          <label className="mb-1 text-xs text-neutral-500">Prefijo</label>
          <input name="prefijo" placeholder="CC" className={`${inp} w-20`} />
        </div>
        <div className="flex flex-col">
          <label className="mb-1 text-xs text-neutral-500">Libro</label>
          <input name="libro" placeholder="10" className={`${inp} w-20`} />
        </div>
        <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800">
          + Categoría
        </button>
      </form>

      <div className="space-y-4">
        {arbol.map((n) => (
          <Nodo key={n.id} nodo={n} />
        ))}
      </div>
    </div>
  );
}
