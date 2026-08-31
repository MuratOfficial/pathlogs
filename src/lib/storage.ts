import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
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
    // R2 документирует path-style (endpoint/bucket/key); с ним же согласована
    // сборка публичного URL ниже.
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
      const base = process.env.S3_PUBLIC_URL?.replace(/\/$/, "");
      const url = base
        ? `${base}/${key}`
        : `${process.env.S3_ENDPOINT?.replace(/\/$/, "")}/${process.env.S3_BUCKET}/${key}`;
      return { key, url, storage: "S3" };
    } catch (err) {
      console.error("S3 upload failed, falling back to local storage:", err);
    }
  }

  await mkdir(LOCAL_DIR, { recursive: true });
  await writeFile(path.join(LOCAL_DIR, key), buffer);
  return { key, url: `/api/files/${encodeURIComponent(key)}`, storage: "LOCAL" };
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
