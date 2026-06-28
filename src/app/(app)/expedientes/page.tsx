import Link from "next/link";
import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { expedientes, tiposDocumento } from "@/db/schema";
import { requireEmpresaId } from "@/lib/session";
import { formatCOP, ETIQUETAS_ESTADO } from "@/lib/format";

type EstadoExpediente = "pendiente" | "completo" | "fusionado";

export default async function ExpedientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tipoId?: string; periodo?: string; estado?: string }>;
}) {
  const sp = await searchParams;
  const { empresaId } = await requireEmpresaId();
  const qs = new URLSearchParams(
    Object.entries(sp).filter(([, v]) => v) as [string, string][],
  ).toString();

  const tipos = await db
    .select()
    .from(tiposDocumento)
    .where(eq(tiposDocumento.empresaId, empresaId))
    .orderBy(tiposDocumento.orden);

  const conds: SQL[] = [eq(expedientes.empresaId, empresaId)];
  if (sp.tipoId) conds.push(eq(expedientes.tipoId, sp.tipoId));
  if (sp.periodo) conds.push(eq(expedientes.periodo, sp.periodo));
  if (sp.estado) conds.push(eq(expedientes.estado, sp.estado as EstadoExpediente));
  if (sp.q) {
    const like = `%${sp.q}%`;
    conds.push(
      or(
        ilike(expedientes.consecutivo, like),
        ilike(expedientes.tercero, like),
        ilike(expedientes.concepto, like),
        ilike(expedientes.nitTercero, like),
      )!,
    );
  }

  const filas = await db
    .select({
      id: expedientes.id,
      consecutivo: expedientes.consecutivo,
      periodo: expedientes.periodo,
      fecha: expedientes.fecha,
      tercero: expedientes.tercero,
      valor: expedientes.valor,
      estado: expedientes.estado,
      tieneCarpetaFisica: expedientes.tieneCarpetaFisica,
      tipoNombre: tiposDocumento.nombre,
      tipoCodigo: tiposDocumento.codigo,
    })
    .from(expedientes)
    .innerJoin(tiposDocumento, eq(expedientes.tipoId, tiposDocumento.id))
    .where(and(...conds))
    .orderBy(desc(expedientes.creadoEn))
    .limit(300);

  const inputCls =
    "rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Expedientes</h1>
        <div className="flex items-center gap-2">
          <a
            href={`/expedientes/export${qs ? `?${qs}` : ""}`}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Exportar CSV
          </a>
          <Link
            href="/expedientes/nuevo"
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            + Nuevo expediente
          </Link>
        </div>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 bg-white p-4">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Buscar (consecutivo, tercero, concepto, NIT)"
          className={`${inputCls} min-w-64 flex-1`}
        />
        <select name="tipoId" defaultValue={sp.tipoId ?? ""} className={inputCls}>
          <option value="">Todos los tipos</option>
          {tipos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.codigo} · {t.nombre}
            </option>
          ))}
        </select>
        <input type="month" name="periodo" defaultValue={sp.periodo ?? ""} className={inputCls} />
        <select name="estado" defaultValue={sp.estado ?? ""} className={inputCls}>
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="completo">Completo</option>
          <option value="fusionado">Fusionado</option>
        </select>
        <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800">
          Filtrar
        </button>
        <Link href="/expedientes" className="px-2 py-2 text-sm text-neutral-500 hover:text-neutral-900">
          Limpiar
        </Link>
      </form>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">Consecutivo</th>
              <th className="px-4 py-2 font-medium">Tipo</th>
              <th className="px-4 py-2 font-medium">Periodo</th>
              <th className="px-4 py-2 font-medium">Tercero</th>
              <th className="px-4 py-2 text-right font-medium">Valor</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              <th className="px-4 py-2 font-medium">Física</th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-neutral-400">
                  No hay expedientes que coincidan. Crea el primero con “+ Nuevo expediente”.
                </td>
              </tr>
            )}
            {filas.map((f) => (
              <tr key={f.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                <td className="px-4 py-2 font-medium">
                  <Link href={`/expedientes/${f.id}`} className="text-neutral-900 hover:underline">
                    {f.consecutivo ?? "—"}
                  </Link>
                </td>
                <td className="px-4 py-2 text-neutral-600">
                  {f.tipoCodigo} · {f.tipoNombre}
                </td>
                <td className="px-4 py-2 text-neutral-600">{f.periodo ?? "—"}</td>
                <td className="px-4 py-2 text-neutral-600">{f.tercero ?? "—"}</td>
                <td className="px-4 py-2 text-right text-neutral-600">{formatCOP(f.valor)}</td>
                <td className="px-4 py-2 text-neutral-600">{ETIQUETAS_ESTADO[f.estado] ?? f.estado}</td>
                <td className="px-4 py-2 text-neutral-600">{f.tieneCarpetaFisica ? "Sí" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-neutral-400">Mostrando hasta 300 resultados.</p>
    </div>
  );
}
