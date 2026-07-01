CREATE TYPE "public"."bitacora_accion" AS ENUM('crear', 'editar', 'eliminar', 'subir_documento', 'eliminar_documento', 'mover');--> statement-breakpoint
CREATE TYPE "public"."bitacora_entidad" AS ENUM('expediente', 'documento', 'tipo_documento');--> statement-breakpoint
CREATE TABLE "bitacora" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"usuario_id" uuid,
	"accion" bitacora_accion NOT NULL,
	"entidad" bitacora_entidad NOT NULL,
	"entidad_id" uuid NOT NULL,
	"detalle" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intentos_login" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"exitoso" boolean NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documentos" ADD COLUMN "eliminado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "expedientes" ADD COLUMN "eliminado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "debe_cambiar_password" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "bitacora" ADD CONSTRAINT "bitacora_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bitacora" ADD CONSTRAINT "bitacora_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bitacora_empresa" ON "bitacora" USING btree ("empresa_id","creado_en");--> statement-breakpoint
CREATE INDEX "idx_bitacora_entidad" ON "bitacora" USING btree ("entidad","entidad_id");--> statement-breakpoint
CREATE INDEX "idx_intentos_email_fecha" ON "intentos_login" USING btree ("email","creado_en");