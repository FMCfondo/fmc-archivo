import { and, desc, eq, like, sql } from "drizzle-orm";
import { db } from "../../src/db";
import { empresas, documentos, expedientes, tiposDocumento } from "../../src/db/schema";

async function main() {
  const empresa = (await db.select().from(empresas).where(eq(empresas.nombre, "FMC")).limit(1))[0];
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(documentos)
    .where(and(eq(documentos.empresaId, empresa.id), like(documentos.r2Key, "%/import/%")));
  console.log(`Documentos importados en BD: ${n}`);

  const porTipo = await db
    .select({ nombre: tiposDocumento.nombre, c: sql<number>`count(*)::int` })
    .from(documentos)
    .innerJoin(expedientes, eq(documentos.expedienteId, expedientes.id))
    .innerJoin(tiposDocumento, eq(expedientes.tipoId, tiposDocumento.id))
    .where(and(eq(documentos.empresaId, empresa.id), like(documentos.r2Key, "%/import/%")))
    .groupBy(tiposDocumento.nombre)
    .orderBy(desc(sql`count(*)`));
  console.log("--- por carpeta ---");
  for (const r of porTipo) console.log(`  ${r.nombre}: ${r.c}`);
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
