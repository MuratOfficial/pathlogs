// Проверка подключения S3-совместимого хранилища (Cloudflare R2).
// Локально:  node --env-file=.env scripts/check-r2.mjs
// Прод-креды: node --env-file=.env.production scripts/check-r2.mjs
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const need = ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_ENDPOINT"];
const missing = need.filter((k) => !process.env[k]);
if (missing.length) {
  console.error("Не заданы переменные:", missing.join(", "));
  process.exit(1);
}
if (!process.env.S3_PUBLIC_URL) {
  console.warn("S3_PUBLIC_URL пуст — ссылки на файлы будут отдавать 403.");
}

const client = new S3Client({
  region: process.env.S3_REGION || "auto",
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});

const key = `_healthcheck-${Date.now()}.txt`;
await client.send(
  new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: "pathlogs r2 check",
    ContentType: "text/plain",
  })
);
console.log("PUT ok:", key);

const base = process.env.S3_PUBLIC_URL?.replace(/\/$/, "");
if (base) {
  const res = await fetch(`${base}/${key}`);
  console.log(
    res.ok
      ? `Публичный доступ ok: ${base}/${key}`
      : `Публичный URL вернул ${res.status} — включите Public access (r2.dev или свой домен) и проверьте S3_PUBLIC_URL`
  );
}

await client.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
console.log("DELETE ok — хранилище настроено верно.");
