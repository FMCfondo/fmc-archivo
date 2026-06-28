import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Falta DATABASE_URL en las variables de entorno (.env.local).");
}

const sql = neon(connectionString);
export const db = drizzle(sql, { schema });
export { schema };
