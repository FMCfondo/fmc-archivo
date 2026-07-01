import { desc, sql } from "drizzle-orm";
import { db } from "../src/db";
import { intentosLogin, bitacora } from "../src/db/schema";

async function main() {
  console.log("=== intentos_login (últimos 5) ===");
  const intentos = await db
    .select()
    .from(intentosLogin)
    .orderBy(desc(intentosLogin.creadoEn))
    .limit(5);
  console.log(intentos);

  console.log("\n=== bitacora (últimos 5) ===");
  const eventos = await db.select().from(bitacora).orderBy(desc(bitacora.creadoEn)).limit(5);
  console.log(eventos);
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
