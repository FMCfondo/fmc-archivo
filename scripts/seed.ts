import { config } from "dotenv";
config({ path: ".env.local" });

import { and, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "../src/db/index";
import { empresas, usuarios, usuariosEmpresas, tiposDocumento } from "../src/db/schema";

// Catálogo curado del archivo de FMC (revisado sobre FMC\ARCHIVO).
// Solo entran documentos finales/soporte; los Excel de conciliación y los
// repositorios de gestión NO se incluyen. prefijo/libro alimentan el consecutivo.
type Sub = { codigo: string; nombre: string; prefijo?: string; libro?: string };
type Cat = { codigo: string; nombre: string; prefijo?: string; libro?: string; subs?: Sub[] };

const CATALOGO: Cat[] = [
  { codigo: "0", nombre: "POR CLASIFICAR" },
  { codigo: "1", nombre: "EGRESOS", prefijo: "CC", libro: "10" },
  { codigo: "2", nombre: "INGRESOS" },
  { codigo: "3", nombre: "RECIBOS DE PAGO" },
  { codigo: "4", nombre: "RECIBOS DE CAJA" },
  { codigo: "5", nombre: "CAUSACIONES" },
  { codigo: "7", nombre: "FACTURAS DE COMPRA / CUENTAS DE COBRO", prefijo: "FC", libro: "3" },
  {
    codigo: "8.1",
    nombre: "FACTURAS DE VENTA",
    subs: [
      { codigo: "8.1.1", nombre: "Asociados" },
      { codigo: "8.1.2", nombre: "Remisiones (vinculados)" },
    ],
  },
  { codigo: "9", nombre: "DOCUMENTO SOPORTE" },
  { codigo: "10", nombre: "ICA" },
  { codigo: "12", nombre: "IVA" },
  { codigo: "13", nombre: "RETENCIÓN EN LA FUENTE" },
  {
    codigo: "14",
    nombre: "CONTABILIDAD",
    subs: [
      { codigo: "14.1", nombre: "Certificación bancaria" },
      { codigo: "14.2", nombre: "Certificados tributarios" },
      { codigo: "14.3", nombre: "Cierre de año" },
      { codigo: "14.4", nombre: "Declaración de renta" },
      { codigo: "14.5", nombre: "Exógena" },
      { codigo: "14.6", nombre: "Transferencias realizadas" },
    ],
  },
  {
    codigo: "15.1",
    nombre: "NÓMINA Y SEGURIDAD SOCIAL",
    subs: [
      { codigo: "15.1.1", nombre: "Nómina quincenal" },
      { codigo: "15.1.2", nombre: "Prima" },
      { codigo: "15.1.3", nombre: "Cesantías e intereses" },
      { codigo: "15.1.4", nombre: "Vacaciones" },
      { codigo: "15.1.5", nombre: "Seguridad social (PILA)" },
    ],
  },
  { codigo: "15.2", nombre: "SEGUROS (PÓLIZAS)" },
  { codigo: "16", nombre: "TRASLADO DE DINERO" },
  {
    codigo: "18",
    nombre: "CDTs / INVERSIONES",
    subs: [
      { codigo: "18.1", nombre: "CDT Banco de Bogotá" },
      { codigo: "18.2", nombre: "CDT CFA" },
      { codigo: "18.3", nombre: "CDT Coopcentral" },
      { codigo: "18.4", nombre: "CDT Bancamía" },
      { codigo: "18.5", nombre: "CDT Confiar" },
      { codigo: "18.6", nombre: "Fiducuenta / FICs" },
    ],
  },
  { codigo: "21", nombre: "AJUSTES CONTABLES" },

  // Repositorios opcionales seleccionados
  { codigo: "8.2", nombre: "RESERVAS PARA SINIESTROS" },
  {
    codigo: "26",
    nombre: "DOCUMENTOS LEGALES",
    subs: [
      { codigo: "26.1", nombre: "Estatutos" },
      { codigo: "26.2", nombre: "Socios" },
      { codigo: "26.3", nombre: "Libros" },
      { codigo: "26.4", nombre: "Títulos accionarios" },
      { codigo: "26.5", nombre: "RUT y Cámara de Comercio" },
    ],
  },
  { codigo: "RF", nombre: "REVISORÍA FISCAL" },
  { codigo: "28", nombre: "INFORMACIÓN DE TERCEROS (RUTs)" },
];

async function upsertTipo(
  empresaId: string,
  data: {
    codigo: string;
    nombre: string;
    prefijo?: string;
    libro?: string;
    parentId?: string | null;
    orden: number;
  },
) {
  const existing = (
    await db
      .select()
      .from(tiposDocumento)
      .where(and(eq(tiposDocumento.empresaId, empresaId), eq(tiposDocumento.codigo, data.codigo)))
      .limit(1)
  )[0];
  if (existing) return existing;
  return (
    await db
      .insert(tiposDocumento)
      .values({
        empresaId,
        codigo: data.codigo,
        nombre: data.nombre,
        prefijo: data.prefijo ?? null,
        libro: data.libro ?? null,
        parentId: data.parentId ?? null,
        orden: data.orden,
      })
      .returning()
  )[0];
}

async function main() {
  // 1) Empresa FMC
  let empresa = (
    await db.select().from(empresas).where(eq(empresas.nombre, "FMC")).limit(1)
  )[0];
  if (!empresa) {
    empresa = (await db.insert(empresas).values({ nombre: "FMC" }).returning())[0];
    console.log("✔ Empresa FMC creada");
  } else {
    console.log("· Empresa FMC ya existía");
  }

  // 2) Usuario administrador
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@fmc.local").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  let user = (
    await db.select().from(usuarios).where(eq(usuarios.email, email)).limit(1)
  )[0];
  if (!user) {
    if (!password || password.length < 8) {
      throw new Error(
        "Define SEED_ADMIN_PASSWORD en .env.local con al menos 8 caracteres antes de correr el seed (no hay clave por defecto).",
      );
    }
    const passwordHash = await bcrypt.hash(password, 10);
    user = (
      await db
        .insert(usuarios)
        .values({ email, nombre: "Administrador", passwordHash, debeCambiarPassword: true })
        .returning()
    )[0];
    console.log(`✔ Usuario admin creado -> ${email} (se pedirá cambiar la clave al ingresar)`);
  } else {
    console.log(`· Usuario ${email} ya existía`);
  }

  // 3) Membresía admin -> FMC
  await db
    .insert(usuariosEmpresas)
    .values({ usuarioId: user.id, empresaId: empresa.id, rol: "admin" })
    .onConflictDoNothing();

  // 4) Catálogo (categorías + subcategorías)
  let orden = 0;
  let nCats = 0;
  let nSubs = 0;
  for (const cat of CATALOGO) {
    const padre = await upsertTipo(empresa.id, {
      codigo: cat.codigo,
      nombre: cat.nombre,
      prefijo: cat.prefijo,
      libro: cat.libro,
      parentId: null,
      orden: orden++,
    });
    nCats++;
    for (const sub of cat.subs ?? []) {
      await upsertTipo(empresa.id, {
        codigo: sub.codigo,
        nombre: sub.nombre,
        prefijo: sub.prefijo,
        libro: sub.libro,
        parentId: padre.id,
        orden: orden++,
      });
      nSubs++;
    }
  }
  console.log(`✔ Catálogo cargado (${nCats} categorías, ${nSubs} subcategorías)`);

  console.log("\nSeed completado.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error en el seed:", err);
  process.exit(1);
});
