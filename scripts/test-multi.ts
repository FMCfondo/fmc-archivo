import { eq } from "drizzle-orm";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { db } from "../src/db";
import { empresas, expedientes, documentos } from "../src/db/schema";
import { r2, R2_BUCKET } from "../src/lib/r2";

async function main() {
  const empresa = (await db.select().from(empresas).where(eq(empresas.nombre, "FMC")).limit(1))[0];
  const tipo = (await db.select().from(expedientes).limit(1))[0];
  const tipoId = tipo?.tipoId;
  if (!tipoId) {
    console.log("No hay expedientes para tomar un tipoId de referencia; usando el primer tipo.");
  }

  const N = 8;
  const creados: { expId: string; key: string }[] = [];
  for (let i = 0; i < N; i++) {
    try {
      const [exp] = await db
        .insert(expedientes)
        .values({
          empresaId: empresa.id,
          tipoId: tipoId!,
          consecutivo: `__TEST__-${Date.now()}-${i}`,
          numero: i,
          concepto: `__TEST__ ${i + 1}`,
        })
        .returning({ id: expedientes.id });

      const key = `${empresa.id}/__test__/${Date.now()}-${i}.txt`;
      await r2.send(
        new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: `test ${i}`, ContentType: "text/plain" }),
      );

      await db.insert(documentos).values({
        expedienteId: exp.id,
        empresaId: empresa.id,
        tipoSoporte: "principal",
        nombreArchivo: `t${i}.txt`,
        r2Key: key,
        mime: "text/plain",
        tamano: 6,
      });

      creados.push({ expId: exp.id, key });
      console.log(`OK ${i + 1}/${N}`);
    } catch (e) {
      console.log(`✗ FALLÓ en el #${i + 1}:`, (e as Error)?.message);
      break;
    }
  }

  console.log(`\nResultado: ${creados.length} de ${N} creados.`);

  for (const c of creados) {
    try {
      await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: c.key }));
    } catch {}
    await db.delete(expedientes).where(eq(expedientes.id, c.expId));
  }
  console.log("Limpieza de los de prueba: hecha.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
