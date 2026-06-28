import type { TipoNodo } from "@/lib/tipos";

export type DatosExpediente = {
  tipoId?: string | null;
  consecutivo?: string | null;
  periodo?: string | null;
  fecha?: string | null;
  tercero?: string | null;
  nitTercero?: string | null;
  valor?: string | null;
  estado?: string | null;
  concepto?: string | null;
  tieneCarpetaFisica?: boolean;
  rotuloCarpeta?: string | null;
  ubicacionFisica?: string | null;
  folio?: string | null;
  notas?: string | null;
};

const label = "mb-1 block text-sm font-medium text-neutral-700";
const input =
  "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900";

export function CamposExpediente({
  opciones,
  exp,
}: {
  opciones: TipoNodo[];
  exp?: DatosExpediente;
}) {
  return (
    <>
      {/* Identificación */}
      <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-500">Identificación</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="tipoId" className={label}>
              Tipo de documento *
            </label>
            <select
              id="tipoId"
              name="tipoId"
              required
              defaultValue={exp?.tipoId ?? ""}
              className={input}
            >
              <option value="" disabled>
                Selecciona una categoría…
              </option>
              {opciones.map((o) => (
                <option key={o.id} value={o.id}>
                  {`${"— ".repeat(o.nivel)}${o.codigo} · ${o.nombre}`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="consecutivo" className={label}>
              Consecutivo
            </label>
            <input
              id="consecutivo"
              name="consecutivo"
              defaultValue={exp?.consecutivo ?? ""}
              placeholder="Automático si lo dejas vacío"
              className={input}
            />
            <p className="mt-1 text-xs text-neutral-400">
              Se genera solo según el tipo; puedes escribir uno distinto para corregirlo.
            </p>
          </div>
          <div>
            <label htmlFor="periodo" className={label}>
              Periodo
            </label>
            <input
              id="periodo"
              name="periodo"
              type="month"
              defaultValue={exp?.periodo ?? ""}
              className={input}
            />
          </div>
          <div>
            <label htmlFor="fecha" className={label}>
              Fecha del documento
            </label>
            <input
              id="fecha"
              name="fecha"
              type="date"
              defaultValue={exp?.fecha ?? ""}
              className={input}
            />
          </div>
          <div>
            <label htmlFor="tercero" className={label}>
              Tercero (proveedor / empleado / cliente)
            </label>
            <input id="tercero" name="tercero" defaultValue={exp?.tercero ?? ""} className={input} />
          </div>
          <div>
            <label htmlFor="nitTercero" className={label}>
              NIT / Cédula
            </label>
            <input
              id="nitTercero"
              name="nitTercero"
              defaultValue={exp?.nitTercero ?? ""}
              className={input}
            />
          </div>
          <div>
            <label htmlFor="valor" className={label}>
              Valor (COP)
            </label>
            <input
              id="valor"
              name="valor"
              type="number"
              step="0.01"
              min="0"
              defaultValue={exp?.valor ?? ""}
              className={input}
            />
          </div>
          <div>
            <label htmlFor="estado" className={label}>
              Estado
            </label>
            <select
              id="estado"
              name="estado"
              defaultValue={exp?.estado ?? "pendiente"}
              className={input}
            >
              <option value="pendiente">Pendiente (faltan soportes)</option>
              <option value="completo">Completo</option>
              <option value="fusionado">Fusionado</option>
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="concepto" className={label}>
            Concepto / descripción
          </label>
          <textarea
            id="concepto"
            name="concepto"
            rows={2}
            defaultValue={exp?.concepto ?? ""}
            className={input}
          />
        </div>
      </section>

      {/* Carpeta física */}
      <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-500">Carpeta física</h2>
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            name="tieneCarpetaFisica"
            defaultChecked={exp?.tieneCarpetaFisica ?? false}
            className="h-4 w-4"
          />
          Existe una carpeta física para este expediente
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="rotuloCarpeta" className={label}>
              Rótulo de la carpeta
            </label>
            <input
              id="rotuloCarpeta"
              name="rotuloCarpeta"
              defaultValue={exp?.rotuloCarpeta ?? ""}
              placeholder="Ej. AZ 10 - EGRESOS 2024"
              className={input}
            />
          </div>
          <div>
            <label htmlFor="ubicacionFisica" className={label}>
              Ubicación
            </label>
            <input
              id="ubicacionFisica"
              name="ubicacionFisica"
              defaultValue={exp?.ubicacionFisica ?? ""}
              placeholder="Archivador / oficina / caja"
              className={input}
            />
          </div>
          <div>
            <label htmlFor="folio" className={label}>
              Folio
            </label>
            <input id="folio" name="folio" defaultValue={exp?.folio ?? ""} className={input} />
          </div>
        </div>
      </section>

      {/* Notas */}
      <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5">
        <label htmlFor="notas" className={label}>
          Notas
        </label>
        <textarea id="notas" name="notas" rows={2} defaultValue={exp?.notas ?? ""} className={input} />
      </section>
    </>
  );
}
