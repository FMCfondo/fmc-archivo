import { and, eq, sql } from "drizzle-orm";
import { db } from "../src/db";
import { empresas, consecutivos } from "../src/db/schema";
import { cargarTipos, resolverSerie } from "../src/lib/tipos";

async function nextAuto(
  empresaId: string,
  serie: { ownerId: string; prefijo: string | null; libro: string | null; codigo: string },
) {
  const [c] = await db
    .insert(consecutivos)
    .values({ empresaId, tipoId: serie.ownerId, ultimo: 1 })
    .onConflictDoUpdate({
      target: [consecutivos.empresaId, consecutivos.tipoId],
      set: { ultimo: sql`${consecutivos.ultimo} + 1` },
    })
    .returning({ ultimo: consecutivos.ultimo });
  return serie.prefijo && serie.libro
    ? `${serie.prefijo}-${serie.libro}-${c.ultimo}`
    : `${serie.codigo}-${c.ultimo}`;
}

async function main() {
  const empresa = (await db.select().from(empresas).where(eq(empresas.nombre, "FMC")).limit(1))[0];
  const tipos = await cargarTipos(empresa.id);

  const egresos = tipos.find((t) => t.nombre === "EGRESOS")!;
  const serie = resolverSerie(tipos, egresos.id);
  console.log("Serie de EGRESOS:", serie, "(esperado prefijo=CC, libro=10)");

  // limpiar contador previo para una prueba limpia
  await db
    .delete(consecutivos)
    .where(and(eq(consecutivos.empresaId, empresa.id), eq(consecutivos.tipoId, serie.ownerId)));

  console.log("auto 1:", await nextAuto(empresa.id, serie), "(esperado CC-10-1)");
  console.log("auto 2:", await nextAuto(empresa.id, serie), "(esperado CC-10-2)");

  // override a 50 (no debe retroceder)
  await db
    .insert(consecutivos)
    .values({ empresaId: empresa.id, tipoId: serie.ownerId, ultimo: 50 })
    .onConflictDoUpdate({
      target: [consecutivos.empresaId, consecutivos.tipoId],
      set: { ultimo: sql`greatest(${consecutivos.ultimo}, 50)` },
    });
  console.log("auto tras override 50:", await nextAuto(empresa.id, serie), "(esperado CC-10-51)");

  // prueba de herencia: subcategoría sin prefijo hereda del padre que sí lo tenga
  const conta = tipos.find((t) => t.nombre === "CONTABILIDAD")!;
  const subConta = tipos.find((t) => t.parentId === conta.id);
  if (subConta) {
    const s = resolverSerie(tipos, subConta.id);
    console.log(
      `Serie de subcategoría "${subConta.nombre}":`,
      { prefijo: s.prefijo, libro: s.libro, codigo: s.codigo },
      "(CONTABILIDAD no tiene prefijo → usa código)",
    );
  }

  // limpieza: dejar el contador en 0
  await db
    .delete(consecutivos)
    .where(and(eq(consecutivos.empresaId, empresa.id), eq(consecutivos.tipoId, serie.ownerId)));
  console.log("\n✅ Prueba de consecutivo OK (contador limpiado).");
  process.exit(0);
}

main().catch((e) => {
  console.error("✗ Error:", e);
  process.exit(1);
});
