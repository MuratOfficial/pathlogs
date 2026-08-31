// Проверка подключения S3-совместимого хранилища (Cloudflare R2).
// Локально:  node --env-file=.env scripts/check-r2.mjs
// Прод-креды: node --env-file=.env.production scripts/check-r2.mjs
//
// Бакет должен оставаться приватным: приложение отдаёт файлы через
// /api/files/[key], подписывая ссылку после проверки прав.
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const need = ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_ENDPOINT"];
const missing = need.filter((k) => !process.env[k]);
if (missing.length) {
  console.error("Не заданы переменные:", missing.join(", "));
  process.exit(1);
}
if (/\.com\/./.test(process.env.S3_ENDPOINT)) {
  console.error(
    "В S3_ENDPOINT попал путь. Нужен только хост: https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
  );
  process.exit(1);
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

const Bucket = process.env.S3_BUCKET;
const Key = `_healthcheck-${Date.now()}.txt`;
const body = "pathlogs r2 check";

await client.send(
  new PutObjectCommand({ Bucket, Key, Body: body, ContentType: "text/plain" })
);
console.log("PUT ok:", Key);

// Тот же путь, которым пользуется /api/files/[key]
const signed = await getSignedUrl(client, new GetObjectCommand({ Bucket, Key }), {
  expiresIn: 60,
});
const res = await fetch(signed);
const text = res.ok ? await res.text() : "";
console.log(
  res.ok && text === body
    ? "Подписанная ссылка ok — файл скачался"
    : `Подписанная ссылка вернула ${res.status} — проверьте права токена (Object Read & Write)`
);

// Бакет не должен отдавать объект без подписи
const bare = await fetch(`${process.env.S3_ENDPOINT.replace(/\/$/, "")}/${Bucket}/${Key}`);
console.log(
  bare.ok
    ? `ВНИМАНИЕ: объект доступен без подписи (${bare.status}) — бакет публичный`
    : `Без подписи доступа нет (${bare.status}) — так и должно быть`
);

await client.send(new DeleteObjectCommand({ Bucket, Key }));
console.log("DELETE ok — хранилище настроено верно.");
