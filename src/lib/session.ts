import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

/**
 * Актуальные имя и роль пользователя — или null, если пользователя больше нет
 * или он отключён.
 *
 * По этому ответу решается судьба уже выданного JWT: роль зашивается в токен
 * при входе, и без сверки с БД ни деактивация, ни разжалование не подействовали
 * бы до истечения токена. Лежит отдельным модулем, а не в access.ts, чтобы не
 * замыкать auth.ts и access.ts друг на друга.
 */
export async function currentSessionUser(
  id: string
): Promise<{ name: string; role: Role } | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { name: true, role: true, active: true },
  });
  if (!user?.active) return null;
  return { name: user.name, role: user.role };
}
