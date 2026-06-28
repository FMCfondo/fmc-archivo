CREATE TYPE "public"."estado_expediente" AS ENUM('pendiente', 'completo', 'fusionado');--> statement-breakpoint
CREATE TYPE "public"."rol" AS ENUM('admin', 'editor', 'lector');--> statement-breakpoint
CREATE TYPE "public"."tipo_soporte" AS ENUM('principal', 'factura', 'soporte_pago', 'registro_contable', 'comprobante_bancario', 'otro');--> statement-breakpoint
CREATE TABLE "consecutivos" (
	"empresa_id" uuid NOT NULL,
	"tipo_id" uuid NOT NULL,
	"ultimo" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "consecutivos_empresa_id_tipo_id_pk" PRIMARY KEY("empresa_id","tipo_id")
);
--> statement-breakpoint
CREATE TABLE "documentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expediente_id" uuid NOT NULL,
	"empresa_id" uuid NOT NULL,
	"tipo_soporte" "tipo_soporte" DEFAULT 'otro' NOT NULL,
	"nombre_archivo" text NOT NULL,
	"r2_key" text NOT NULL,
	"mime" text,
	"tamano" integer,
	"subido_por" uuid,
	"subido_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "empresas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"nit" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expedientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"tipo_id" uuid NOT NULL,
	"consecutivo" text,
	"numero" integer,
	"periodo" text,
	"fecha" date,
	"tercero" text,
	"nit_tercero" text,
	"concepto" text,
	"valor" numeric(16, 2),
	"estado" "estado_expediente" DEFAULT 'pendiente' NOT NULL,
	"tiene_carpeta_fisica" boolean DEFAULT false NOT NULL,
	"rotulo_carpeta" text,
	"ubicacion_fisica" text,
	"folio" text,
	"notas" text,
	"creado_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tipos_documento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"prefijo" text,
	"libro" text,
	"parent_id" uuid,
	"orden" integer DEFAULT 0 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"nombre" text NOT NULL,
	"password_hash" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "usuarios_empresas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"empresa_id" uuid NOT NULL,
	"rol" "rol" DEFAULT 'editor' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consecutivos" ADD CONSTRAINT "consecutivos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consecutivos" ADD CONSTRAINT "consecutivos_tipo_id_tipos_documento_id_fk" FOREIGN KEY ("tipo_id") REFERENCES "public"."tipos_documento"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_expediente_id_expedientes_id_fk" FOREIGN KEY ("expediente_id") REFERENCES "public"."expedientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_subido_por_usuarios_id_fk" FOREIGN KEY ("subido_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expedientes" ADD CONSTRAINT "expedientes_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expedientes" ADD CONSTRAINT "expedientes_tipo_id_tipos_documento_id_fk" FOREIGN KEY ("tipo_id") REFERENCES "public"."tipos_documento"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expedientes" ADD CONSTRAINT "expedientes_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tipos_documento" ADD CONSTRAINT "tipos_documento_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tipos_documento" ADD CONSTRAINT "tipos_documento_parent_id_tipos_documento_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tipos_documento"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios_empresas" ADD CONSTRAINT "usuarios_empresas_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios_empresas" ADD CONSTRAINT "usuarios_empresas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_doc_expediente" ON "documentos" USING btree ("expediente_id");--> statement-breakpoint
CREATE INDEX "idx_exp_empresa" ON "expedientes" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX "idx_exp_periodo" ON "expedientes" USING btree ("empresa_id","periodo");--> statement-breakpoint
CREATE INDEX "idx_exp_tipo" ON "expedientes" USING btree ("empresa_id","tipo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_exp_consecutivo" ON "expedientes" USING btree ("empresa_id","consecutivo");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tipo_empresa_codigo" ON "tipos_documento" USING btree ("empresa_id","codigo");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_usuario_empresa" ON "usuarios_empresas" USING btree ("usuario_id","empresa_id");