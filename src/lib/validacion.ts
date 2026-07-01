import { z } from "zod";
import { estadoExpedienteEnum, tipoSoporteEnum } from "@/db/schema";

export const uuidSchema = z.string().uuid();
// Derivados de los pgEnum del schema: un valor nuevo en la BD se acepta aquí automáticamente.
export const tipoSoporteSchema = z.enum(tipoSoporteEnum.enumValues);
export const estadoExpedienteSchema = z.enum(estadoExpedienteEnum.enumValues);

/** Campos de un expediente: valida formato sin ser demasiado estricta (todo es opcional). */
export const camposExpedienteSchema = z.object({
  periodo: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Periodo inválido")
    .nullable(),
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
    .nullable(),
  tercero: z.string().max(300).nullable(),
  nitTercero: z.string().max(50).nullable(),
  concepto: z.string().max(500).nullable(),
  valor: z
    .string()
    .regex(/^\d{1,14}(\.\d{1,2})?$/, "Valor inválido")
    .nullable(),
  estado: estadoExpedienteSchema,
  rotuloCarpeta: z.string().max(200).nullable(),
  ubicacionFisica: z.string().max(200).nullable(),
  folio: z.string().max(100).nullable(),
  notas: z.string().max(2000).nullable(),
});

export const subirArchivoSchema = z.object({
  tipoId: uuidSchema.optional(),
  expedienteId: uuidSchema.optional(),
  tipoSoporte: tipoSoporteSchema.optional(),
});

export const guardarDocumentoSchema = z.object({
  id: uuidSchema,
  nombre: z.string().max(500).nullable(),
  tipoId: uuidSchema.nullable(),
  rotulo: z.string().max(200).nullable(),
  ubicacion: z.string().max(200).nullable(),
});
