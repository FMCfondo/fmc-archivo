import { eq } from "drizzle-orm";
import { db } from "../../src/db";
import { usuarios } from "../../src/db/schema";

async function main() {
  const rows = await db
    .select({ email: usuarios.email, debeCambiarPassword: usuarios.debeCambiarPassword })
    .from(usuarios);
  console.log(rows);
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
