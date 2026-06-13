import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

/** SHA-256 хэш токена (в БД хранится только он). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Генерирует новый токен: возвращает сам токен (показать один раз) и его хэш/префикс. */
export function generateToken(): { token: string; tokenHash: string; prefix: string } {
  const token = "pl_" + randomBytes(24).toString("base64url");
  return { token, tokenHash: hashToken(token), prefix: token.slice(0, 8) };
}

/**
 * Проверяет Bearer-токен из заголовка Authorization. Возвращает пользователя
 * (с ролью) или null. Обновляет lastUsedAt.
 */
export async function authenticateToken(authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  const record = await prisma.apiToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, email: true, name: true, role: true, active: true } } },
  });
  if (!record || !record.user.active) return null;
  // Не блокируем ответ на обновлении метки времени
  prisma.apiToken
    .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});
  return record.user;
}
