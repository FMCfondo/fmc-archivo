import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { expedientes, tiposDocumento } from "@/db/schema";
import { requireEmpresaId } from "@/lib/session";
import { ETIQUETAS_ESTADO } from "@/lib/format";

function Tarjeta({ titulo, valor, acento }: { titulo: string; valor: number; acento?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <p className="text-sm text-neutral-500">{titulo}</p>
      <p className={`mt-1 text-3xl font-semibold ${acento ?? "text-neutral-900"}`}>{valor}</p>
    </div>
  );
}

export default async function InicioPage() {
  const { empresaId } = await requireEmpresaId();

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(expedientes)
    .where(eq(expedientes.empresaId, empresaId));

  const porEstado = await db
    .select({ estado: expedientes.estado, n: sql<number>`count(*)::int` })
    .from(expedientes)
    .where(eq(expedientes.empresaId, empresaId))
    .groupBy(expedientes.estado);
  const estado = (e: string) => porEstado.find((x) => x.estado === e)?.n ?? 0;

  const porTipo = await db
    .select({
      nombre: tiposDocumento.nombre,
      codigo: tiposDocumento.codigo,
      n: sql<number>`count(*)::int`,
    })
    .from(expedientes)
    .innerJoin(tiposDocumento, eq(expedientes.tipoId, tiposDocumento.id))
    .where(eq(expedientes.empresaId, empresaId))
    .groupBy(tiposDocumento.id, tiposDocumento.nombre, tiposDocumento.codigo)
    .orderBy(sql`count(*) desc`)
    .limit(8);

  const recientes = await db
    .select({
      id: expedientes.id,
      consecutivo: expedientes.consecutivo,
      tercero: expedientes.tercero,
      estado: expedientes.estado,
      tipoNombre: tiposDocumento.nombre,
    })
    .from(expedientes)
    .innerJoin(tiposDocumento, eq(expedientes.tipoId, tiposDocumento.id))
    .where(eq(expedientes.empresaId, empresaId))
    .orderBy(desc(expedientes.creadoEn))
    .limit(5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Inicio</h1>
        <Link
          href="/expedientes/nuevo"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          + Nuevo expediente
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Tarjeta titulo="Total" valor={total} />
        <Tarjeta titulo="Pendientes" valor={estado("pendiente")} acento="text-amber-600" />
        <Tarjeta titulo="Completos" valor={estado("completo")} acento="text-emerald-600" />
        <Tarjeta titulo="Fusionados" valor={estado("fusionado")} acento="text-neutral-900" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-neutral-500">Expedientes por tipo</h2>
          {porTipo.length === 0 ? (
            <p className="text-sm text-neutral-400">Aún no hay expedientes.</p>
          ) : (
            <ul className="space-y-1">
              {porTipo.map((t) => (
                <li key={t.codigo} className="flex items-center justify-between text-sm">
                  <span className="text-neutral-700">
                    {t.codigo} · {t.nombre}
                  </span>
                  <span className="font-medium text-neutral-900">{t.n}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-neutral-500">Recientes</h2>
          {recientes.length === 0 ? (
            <p className="text-sm text-neutral-400">Aún no hay expedientes.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {recientes.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                  <Link href={`/expedientes/${r.id}`} className="font-medium hover:underline">
                    {r.consecutivo ?? "—"}
                  </Link>
                  <span className="truncate px-2 text-neutral-500">{r.tercero ?? r.tipoNombre}</span>
                  <span className="text-xs text-neutral-400">{ETIQUETAS_ESTADO[r.estado]}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
