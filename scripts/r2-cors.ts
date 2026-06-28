import { GetBucketCorsCommand, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import { r2, R2_BUCKET } from "../src/lib/r2";

async function main() {
  console.log("=== CORS ACTUAL ===");
  try {
    const r = await r2.send(new GetBucketCorsCommand({ Bucket: R2_BUCKET }));
    console.log(JSON.stringify(r.CORSRules, null, 2));
  } catch (e) {
    console.log("(no se pudo leer):", (e as Error).name, "-", (e as Error).message);
  }

  console.log("\n=== APLICANDO CORS ROBUSTO ===");
  await r2.send(
    new PutBucketCorsCommand({
      Bucket: R2_BUCKET,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: ["http://localhost:3000", "https://fmc-archivo.vercel.app"],
            AllowedMethods: ["GET", "PUT", "HEAD"],
            AllowedHeaders: ["*"],
            ExposeHeaders: ["ETag"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );
  console.log("Aplicado.");

  const after = await r2.send(new GetBucketCorsCommand({ Bucket: R2_BUCKET }));
  console.log("\n=== CORS NUEVO ===");
  console.log(JSON.stringify(after.CORSRules, null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
