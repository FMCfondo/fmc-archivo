import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { r2, R2_BUCKET } from "../../src/lib/r2";

async function main() {
  const key = `__test__/${Date.now()}.txt`;
  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: "hola fmc",
      ContentType: "text/plain",
    }),
  );
  console.log("✔ PutObject OK ->", key);

  const got = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  const body = await got.Body?.transformToString();
  console.log("✔ GetObject OK -> contenido:", body);

  await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  console.log("✔ DeleteObject OK");

  console.log(`\n✅ R2 conectado correctamente (bucket: ${R2_BUCKET})`);
  process.exit(0);
}

main().catch((e) => {
  console.error("✗ Error R2:", e?.name, "-", e?.message);
  process.exit(1);
});
