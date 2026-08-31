import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import type { StorageType } from "@prisma/client";

const LOCAL_DIR = path.join(process.cwd(), "uploads");

/** S3/R2 настроен — значит новые файлы уходят в облако, а не на диск. */
export function isS3Configured(): boolean {
  return Boolean(
    process.env.S3_BUCKET &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY
  );
}

function makeS3Client(): S3Client {
  return new S3Client({
    region: process.env.S3_REGION || "auto",
    ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT } : {}),
    // R2 документирует path-style: endpoint/bucket/key. В S3_ENDPOINT должен
    // быть только хост — имя бакета клиент подставляет сам.
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });
}

export interface StoredFile {
  key: string;
  url: string;
  storage: StorageType;
}

/** Единственная точка, где собирается ссылка на файл. */
function fileUrl(key: string): string {
  return `/api/files/${encodeURIComponent(key)}`;
}

/** Сколько живёт подписанная ссылка. Хватает, чтобы браузер начал скачивание. */
const SIGNED_URL_TTL_SECONDS = 300;

/**
 * Временная прямая ссылка в R2. Отдаётся только после проверки прав — роут
 * редиректит на неё, дальше браузер качает мимо приложения (исходящий
 * трафик у R2 бесплатный).
 */
export async function presignedFileUrl(
  key: string,
  filename: string,
  mime: string
): Promise<string> {
  return getSignedUrl(
    makeS3Client(),
    new GetObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      ResponseContentType: mime,
      ResponseContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
    }),
    { expiresIn: SIGNED_URL_TTL_SECONDS }
  );
}

/**
 * Сохраняет файл: сначала пробует S3 (если сконфигурирован),
 * при ошибке или отсутствии конфигурации — локальный диск (./uploads).
 */
export async function storeFile(
  buffer: Buffer,
  filename: string,
  mime: string
): Promise<StoredFile> {
  const safeName = filename.replace(/[^\w.\-а-яА-ЯёЁ]/g, "_");
  const key = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}-${safeName}`;

  if (isS3Configured()) {
    try {
      const client = makeS3Client();
      await client.send(
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET!,
          Key: key,
          Body: buffer,
          ContentType: mime,
        })
      );
      // Ссылка ведёт на свой роут, а не напрямую в бакет: бакет остаётся
      // приватным, а права на файл проверяются на каждом скачивании.
      return { key, url: fileUrl(key), storage: "S3" };
    } catch (err) {
      console.error("S3 upload failed, falling back to local storage:", err);
    }
  }

  await mkdir(LOCAL_DIR, { recursive: true });
  await writeFile(path.join(LOCAL_DIR, key), buffer);
  return { key, url: fileUrl(key), storage: "LOCAL" };
}

/**
 * Убирает сам файл из хранилища. Best-effort: ошибка логируется, но наверх
 * не всплывает — удаление вложения в БД не должно падать из-за недоступного R2.
 * Возвращает true, если объект действительно удалён.
 */
export async function deleteStoredFile(
  key: string,
  storage: StorageType
): Promise<boolean> {
  try {
    if (storage === "S3") {
      if (!isS3Configured()) return false;
      await makeS3Client().send(
        new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key })
      );
      return true;
    }
    await unlink(localFilePath(key));
    return true;
  } catch (err) {
    console.error(`Не удалось удалить файл ${key} из ${storage}:`, err);
    return false;
  }
}

/** То же для пачки файлов — например, при удалении задачи со вложениями. */
export async function deleteStoredFiles(
  files: { key: string; storage: StorageType }[]
): Promise<void> {
  await Promise.all(files.map((f) => deleteStoredFile(f.key, f.storage)));
}

export function localFilePath(key: string): string {
  // Защита от path traversal
  const resolved = path.resolve(LOCAL_DIR, key);
  if (!resolved.startsWith(path.resolve(LOCAL_DIR))) {
    throw new Error("Недопустимый путь к файлу");
  }
  return resolved;
}
