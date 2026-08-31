import { prisma } from "@/lib/prisma";

const GB = 1024 ** 3;

/**
 * Бесплатная квота Cloudflare R2 — 10 ГБ хранения в месяц. Всё, что сверх,
 * тарифицируется и списывается с привязанной карты, поэтому загрузка
 * останавливается на границе, а не «когда-нибудь потом».
 */
export const DEFAULT_QUOTA_BYTES = 10 * GB;

/** Порог предупреждения: с 90 % занятого места пора чистить вложения. */
export const WARN_RATIO = 0.9;

/** Лимит можно поднять через STORAGE_QUOTA_BYTES, если тариф платный. */
export function quotaLimitBytes(): number {
  const raw = Number(process.env.STORAGE_QUOTA_BYTES);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_QUOTA_BYTES;
}

export function formatBytes(bytes: number): string {
  if (bytes >= GB) return `${(bytes / GB).toFixed(1)} ГБ`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} МБ`;
  return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}

export interface QuotaState {
  used: number;
  limit: number;
  /** Сколько ещё влезет; ноль, если лимит уже выбран. */
  free: number;
  ratio: number;
  nearLimit: boolean;
}

/** Чистая арифметика — вынесена отдельно, чтобы проверять без похода в БД. */
export function quotaState(used: number, limit: number): QuotaState {
  const ratio = limit > 0 ? used / limit : 0;
  return {
    used,
    limit,
    free: Math.max(0, limit - used),
    ratio,
    nearLimit: ratio >= WARN_RATIO,
  };
}

/** Влезает ли ещё один файл. */
export function fitsInQuota(used: number, incoming: number, limit: number): boolean {
  return used + incoming <= limit;
}

/**
 * Сколько байт занято в облаке. Локальные файлы не считаем: они лежат на диске
 * и на счёт Cloudflare не влияют.
 */
export async function usedStorageBytes(): Promise<number> {
  const agg = await prisma.attachment.aggregate({
    _sum: { size: true },
    where: { storage: "S3" },
  });
  return agg._sum.size ?? 0;
}

export async function storageQuotaState(): Promise<QuotaState> {
  return quotaState(await usedStorageBytes(), quotaLimitBytes());
}
