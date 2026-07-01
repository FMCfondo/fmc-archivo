import { S3Client, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const R2_BUCKET = process.env.R2_BUCKET ?? "fmc-archivo";

export const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  },
});

/** URL prefirmada para DESCARGAR/VER un archivo (válida 10 min). */
export async function urlDescarga(key: string) {
  return getSignedUrl(r2, new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }), {
    expiresIn: 600,
  });
}

/** Eliminar un archivo de R2. */
export async function eliminarObjeto(key: string) {
  await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
}

/** Descargar los bytes de un archivo desde R2 (para unir PDFs en el servidor). */
export async function obtenerBytes(key: string): Promise<Uint8Array> {
  const res = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  const arr = await res.Body?.transformToByteArray();
  if (!arr) throw new Error("Archivo vacío en R2.");
  return arr;
}
