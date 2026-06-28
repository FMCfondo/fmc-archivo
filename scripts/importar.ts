import { readdir, readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, extname, basename } from "node:path";
import { and, eq, like, sql } from "drizzle-orm";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { db } from "../src/db";
import { empresas, usuariosEmpresas, tiposDocumento, expedientes, documentos } from "../src/db/schema";
import { r2, R2_BUCKET } from "../src/lib/r2";

const BASE = "L:\\Mi unidad\\Fondo Mutuo De Cobertura\\FMC\\ARCHIVO";
const REAL = process.argv.includes("--real");
const RESET = process.argv.includes("--reset");
const EXTS = [".pdf", ".jpg", ".jpeg", ".png"];

const MAPA: Record<string, { nombre: string; codigo: string; importar: boolean }> = {
  "1--EGRESOS": { nombre: "EGRESOS", codigo: "1", importar: true },
  "2--INGRESOS": { nombre: "INGRESOS", codigo: "2", importar: true },
  "3--RECIBOS DE PAGO": { nombre: "RECIBOS DE PAGO", codigo: "3", importar: true },
  "4--RECIBOS DE CAJA": { nombre: "RECIBOS DE CAJA", codigo: "4", importar: true },
  "5--CAUSACIONES": { nombre: "CAUSACIONES", codigo: "5", importar: true },
  "7--FACTURAS DE COMPRA-DOCUMENTOS DE COBRO-CUENTAS DE COBRO": {
    nombre: "FACTURAS DE COMPRA / CUENTAS DE COBRO",
    codigo: "7",
    importar: true,
  },
  "8.1--FACTURAS DE VENTA": { nombre: "FACTURAS DE VENTA", codigo: "8.1", importar: true },
  "8.2--RESERVAS PARA SINIESTROS": { nombre: "RESERVAS PARA SINIESTROS", codigo: "8.2", importar: true },
  "10--ICA": { nombre: "ICA", codigo: "10", importar: true },
  "12--IVA": { nombre: "IVA", codigo: "12", importar: true },
  "13--RETENCIÓN EN LA FUENTE": { nombre: "RETENCIÓN EN LA FUENTE", codigo: "13", importar: true },
  "14--CONTABILIDAD": { nombre: "CONTABILIDAD", codigo: "14", importar: true },
  "15.1--NOMINA Y SEGURIDAD SOCIAL": { nombre: "NÓMINA Y SEGURIDAD SOCIAL", codigo: "15.1", importar: true },
  "15.2 -- Seguros (Pólizas)": { nombre: "SEGUROS (PÓLIZAS)", codigo: "15.2", importar: true },
  "16--TRASLADO DE DINERO": { nombre: "TRASLADO DE DINERO", codigo: "16", importar: true },
  "21--AJUSTES CONTABLES": { nombre: "AJUSTES CONTABLES", codigo: "21", importar: true },
  "26. DOCUMENTOS LEGALES": { nombre: "DOCUMENTOS LEGALES", codigo: "26", importar: true },
  "28. INFORMACIÓ TERCEROS (RUTs)": { nombre: "INFORMACIÓN DE TERCEROS (RUTs)", codigo: "28", importar: true },
  "25. REVISORIA FISCAL": { nombre: "REVISORÍA FISCAL", codigo: "RF", importar: true },
  "6.1--CONCILIACIÓNES(BANCOS, CDTs)": { nombre: "CONCILIACIONES (BANCOS, CDTs)", codigo: "6.1", importar: false },
  "6.2--CONCILIACIÓN CAJA": { nombre: "CONCILIACIÓN CAJA", codigo: "6.2", importar: false },
  "19.1--RECLAMACIONES": { nombre: "RECLAMACIONES", codigo: "19.1", importar: false },
  "22.1 SGC 2024": { nombre: "SGC", codigo: "22.1", importar: false },
  "24. PLANEACIÓN ESTRATEGICA": { nombre: "PLANEACIÓN ESTRATÉGICA", codigo: "24", importar: false },
  DIAN: { nombre: "DIAN", codigo: "DIAN", importar: false },
  "23.1 SG-SST": { nombre: "SG-SST", codigo: "23.1", importar: false },
  "23.2 SEGURIDAD Y TI": { nombre: "SEGURIDAD Y TI", codigo: "23.2", importar: false },
};

const norm = (s: string) =>
  s.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
const mimeDe = (ext: string) =>
  ext === ".pdf" ? "application/pdf" : ext === ".png" ? "image/png" : "image/jpeg";

async function main() {
  console.log(REAL ? "### MODO REAL ###" : "### SIMULACIÓN (usa --real) ###");
  const empresa = (await db.select().from(empresas).where(eq(empresas.nombre, "FMC")).limit(1))[0];
  const empresaId = empresa.id;
  const adminMemb = (
    await db
      .select({ usuarioId: usuariosEmpresas.usuarioId })
      .from(usuariosEmpresas)
      .where(and(eq(usuariosEmpresas.empresaId, empresaId), eq(usuariosEmpresas.rol, "admin")))
      .limit(1)
  )[0];
  const userId = adminMemb.usuarioId;

  if (RESET && REAL) {
    const previos = await db
      .select({ expedienteId: documentos.expedienteId, r2Key: documentos.r2Key })
      .from(documentos)
      .where(and(eq(documentos.empresaId, empresaId), like(documentos.r2Key, "%/import/%")));
    console.log(`Reset: borrando ${previos.length} documentos importados antes...`);
    for (const d of previos) {
      try {
        await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: d.r2Key }));
      } catch {}
    }
    const expIds = [...new Set(previos.map((d) => d.expedienteId))];
    for (const id of expIds) await db.delete(expedientes).where(eq(expedientes.id, id));
    console.log(`Reset listo (${expIds.length} expedientes eliminados).`);
  }

  const tipos = await db.select().from(tiposDocumento).where(eq(tiposDocumento.empresaId, empresaId));
  const porNombre = new Map(tipos.map((t) => [norm(t.nombre), t]));

  async function ensureCarpeta(nombre: string, codigo: string): Promise<string> {
    const found = porNombre.get(norm(nombre));
    if (found) return found.id;
    if (!REAL) return "DRY";
    const [{ maxOrden }] = await db
      .select({ maxOrden: sql<number>`coalesce(max(${tiposDocumento.orden}), 0)` })
      .from(tiposDocumento)
      .where(eq(tiposDocumento.empresaId, empresaId));
    let cod = codigo;
    if (tipos.some((t) => t.codigo === cod)) cod = `${codigo}-${Date.now().toString(36)}`;
    const [t] = await db
      .insert(tiposDocumento)
      .values({ empresaId, codigo: cod, nombre, orden: (Number(maxOrden) || 0) + 1 })
      .returning();
    porNombre.set(norm(nombre), t);
    tipos.push(t);
    return t.id;
  }

  let totalSubidos = 0;
  let totalDupContenido = 0;

  for (const [driveName, cfg] of Object.entries(MAPA)) {
    const carpetaPath = join(BASE, driveName);
    const tipoId = await ensureCarpeta(cfg.nombre, cfg.codigo);
    if (!cfg.importar) {
      console.log(`📁 ${cfg.nombre} (carpeta lista, sin importar)`);
      continue;
    }

    let rels: string[] = [];
    try {
      rels = await readdir(carpetaPath, { recursive: true });
    } catch {
      console.log(`⚠ No se pudo leer: ${driveName}`);
      continue;
    }

    const hashes = new Set<string>();
    const nombresUsados = new Map<string, number>();
    let subidos = 0;
    let dups = 0;

    for (const rel of rels) {
      const ext = extname(rel).toLowerCase();
      if (!EXTS.includes(ext)) continue;
      const full = join(carpetaPath, rel);
      let st;
      try {
        st = await stat(full);
      } catch {
        continue;
      }
      if (!st.isFile()) continue;

      if (!REAL) {
        subidos++;
        totalSubidos++;
        continue;
      }

      const bytes = await readFile(full);
      const hash = createHash("sha256").update(bytes).digest("hex");
      if (hashes.has(hash)) {
        dups++;
        totalDupContenido++;
        continue;
      }
      hashes.add(hash);

      const original = basename(rel);
      let nombreFinal = original;
      const usadas = nombresUsados.get(original) ?? 0;
      if (usadas > 0) {
        const sinExt = original.replace(/\.[^.]+$/, "");
        nombreFinal = `${sinExt} (${usadas + 1})${ext}`;
      }
      nombresUsados.set(original, usadas + 1);

      const key = `${empresaId}/import/${crypto.randomUUID()}${ext}`;
      const mime = mimeDe(ext);
      await r2.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: bytes, ContentType: mime }));
      const [exp] = await db
        .insert(expedientes)
        .values({ empresaId, tipoId, concepto: nombreFinal.replace(/\.[^.]+$/, ""), creadoPor: userId })
        .returning({ id: expedientes.id });
      await db.insert(documentos).values({
        expedienteId: exp.id,
        empresaId,
        tipoSoporte: "principal",
        nombreArchivo: nombreFinal,
        r2Key: key,
        mime,
        tamano: st.size,
        subidoPor: userId,
      });
      subidos++;
      totalSubidos++;
      if (totalSubidos % 50 === 0) console.log(`   ... ${totalSubidos} subidos`);
    }
    console.log(`📂 ${cfg.nombre}: ${subidos} subidos${dups ? ` (${dups} copias idénticas omitidas)` : ""}`);
  }

  console.log(`\nTotal: ${totalSubidos} documentos${REAL ? ` (${totalDupContenido} copias idénticas omitidas)` : ""}.`);
  process.exit(0);
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
