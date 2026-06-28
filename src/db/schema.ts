import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  date,
  timestamp,
  pgEnum,
  uniqueIndex,
  index,
  primaryKey,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ---------- Enums ----------
export const rolEnum = pgEnum("rol", ["admin", "editor", "lector"]);
export const estadoExpedienteEnum = pgEnum("estado_expediente", [
  "pendiente", // faltan soportes
  "completo", // tiene todos los soportes
  "fusionado", // exportado/unificado en un solo PDF
]);
export const tipoSoporteEnum = pgEnum("tipo_soporte", [
  "principal",
  "factura",
  "soporte_pago",
  "registro_contable",
  "comprobante_bancario",
  "otro",
]);

// ---------- Empresas (tenants) ----------
export const empresas = pgTable("empresas", {
  id: uuid("id").defaultRandom().primaryKey(),
  nombre: text("nombre").notNull(),
  nit: text("nit"),
  creadoEn: timestamp("creado_en", { withTimezone: true }).defaultNow().notNull(),
});

// ---------- Usuarios ----------
export const usuarios = pgTable("usuarios", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  nombre: text("nombre").notNull(),
  passwordHash: text("password_hash").notNull(),
  creadoEn: timestamp("creado_en", { withTimezone: true }).defaultNow().notNull(),
});

// ---------- Membresía usuario <-> empresa (con rol) ----------
export const usuariosEmpresas = pgTable(
  "usuarios_empresas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    rol: rolEnum("rol").notNull().default("editor"),
  },
  (t) => [uniqueIndex("uq_usuario_empresa").on(t.usuarioId, t.empresaId)],
);

// ---------- Tipos de documento (taxonomía 1-32 por empresa) ----------
export const tiposDocumento = pgTable(
  "tipos_documento",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    codigo: text("codigo").notNull(), // "1", "7", "15.1"
    nombre: text("nombre").notNull(), // "EGRESOS"
    prefijo: text("prefijo"), // "CC", "FC" (para el consecutivo)
    libro: text("libro"), // "10", "3"
    parentId: uuid("parent_id").references((): AnyPgColumn => tiposDocumento.id, {
      onDelete: "set null",
    }), // categoría padre (null = categoría raíz; con valor = subcategoría)
    orden: integer("orden").notNull().default(0),
    activo: boolean("activo").notNull().default(true),
  },
  (t) => [uniqueIndex("uq_tipo_empresa_codigo").on(t.empresaId, t.codigo)],
);

// ---------- Contador de consecutivos por empresa+tipo ----------
export const consecutivos = pgTable(
  "consecutivos",
  {
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    tipoId: uuid("tipo_id")
      .notNull()
      .references(() => tiposDocumento.id, { onDelete: "cascade" }),
    ultimo: integer("ultimo").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.empresaId, t.tipoId] })],
);

// ---------- Expedientes (el asiento de archivo) ----------
export const expedientes = pgTable(
  "expedientes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    tipoId: uuid("tipo_id")
      .notNull()
      .references(() => tiposDocumento.id),
    consecutivo: text("consecutivo"), // "CC-10-60"
    numero: integer("numero"), // parte numérica del consecutivo
    periodo: text("periodo"), // "2024-09" (AAAA-MM)
    fecha: date("fecha"),
    tercero: text("tercero"), // proveedor / empleado / cliente
    nitTercero: text("nit_tercero"),
    concepto: text("concepto"),
    valor: numeric("valor", { precision: 16, scale: 2 }),
    estado: estadoExpedienteEnum("estado").notNull().default("pendiente"),
    // Carpeta física
    tieneCarpetaFisica: boolean("tiene_carpeta_fisica").notNull().default(false),
    rotuloCarpeta: text("rotulo_carpeta"), // "AZ 10 - EGRESOS 2024"
    ubicacionFisica: text("ubicacion_fisica"), // archivador / oficina / caja
    folio: text("folio"),
    notas: text("notas"),
    creadoPor: uuid("creado_por").references(() => usuarios.id),
    creadoEn: timestamp("creado_en", { withTimezone: true }).defaultNow().notNull(),
    actualizadoEn: timestamp("actualizado_en", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_exp_empresa").on(t.empresaId),
    index("idx_exp_periodo").on(t.empresaId, t.periodo),
    index("idx_exp_tipo").on(t.empresaId, t.tipoId),
    uniqueIndex("uq_exp_consecutivo").on(t.empresaId, t.consecutivo),
  ],
);

// ---------- Documentos (PDF principal + soportes en R2) ----------
export const documentos = pgTable(
  "documentos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    expedienteId: uuid("expediente_id")
      .notNull()
      .references(() => expedientes.id, { onDelete: "cascade" }),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    tipoSoporte: tipoSoporteEnum("tipo_soporte").notNull().default("otro"),
    nombreArchivo: text("nombre_archivo").notNull(),
    r2Key: text("r2_key").notNull(), // ruta del objeto en R2
    mime: text("mime"),
    tamano: integer("tamano"), // bytes
    subidoPor: uuid("subido_por").references(() => usuarios.id),
    subidoEn: timestamp("subido_en", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_doc_expediente").on(t.expedienteId)],
);

// ---------- Relaciones (para el query API de Drizzle) ----------
export const empresasRelations = relations(empresas, ({ many }) => ({
  tipos: many(tiposDocumento),
  expedientes: many(expedientes),
  miembros: many(usuariosEmpresas),
}));

export const usuariosRelations = relations(usuarios, ({ many }) => ({
  membresias: many(usuariosEmpresas),
}));

export const usuariosEmpresasRelations = relations(usuariosEmpresas, ({ one }) => ({
  usuario: one(usuarios, { fields: [usuariosEmpresas.usuarioId], references: [usuarios.id] }),
  empresa: one(empresas, { fields: [usuariosEmpresas.empresaId], references: [empresas.id] }),
}));

export const tiposDocumentoRelations = relations(tiposDocumento, ({ one, many }) => ({
  empresa: one(empresas, { fields: [tiposDocumento.empresaId], references: [empresas.id] }),
  expedientes: many(expedientes),
  padre: one(tiposDocumento, {
    fields: [tiposDocumento.parentId],
    references: [tiposDocumento.id],
    relationName: "subtipos",
  }),
  subtipos: many(tiposDocumento, { relationName: "subtipos" }),
}));

export const expedientesRelations = relations(expedientes, ({ one, many }) => ({
  empresa: one(empresas, { fields: [expedientes.empresaId], references: [empresas.id] }),
  tipo: one(tiposDocumento, { fields: [expedientes.tipoId], references: [tiposDocumento.id] }),
  documentos: many(documentos),
}));

export const documentosRelations = relations(documentos, ({ one }) => ({
  expediente: one(expedientes, { fields: [documentos.expedienteId], references: [expedientes.id] }),
}));
