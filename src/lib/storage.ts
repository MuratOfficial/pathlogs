import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import type { StorageType } from "@prisma/client";

const LOCAL_DIR = path.join(process.cwd(), "uploads");

function s3Configured(): boolean {
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

  if (s3Configured()) {
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

export function localFilePath(key: string): string {
  // Защита от path traversal
  const resolved = path.resolve(LOCAL_DIR, key);
  if (!resolved.startsWith(path.resolve(LOCAL_DIR))) {
    throw new Error("Недопустимый путь к файлу");
  }
  return resolved;
}
