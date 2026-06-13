"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/auth";
import { generateToken } from "@/lib/tokens";
import { revalidatePath } from "next/cache";

/** Создаёт API-токен. Сам токен возвращается единожды и больше не хранится. */
export async function createApiTokenAction(
  _prev: { token?: string; error?: string } | undefined,
  formData: FormData
): Promise<{ token?: string; error?: string }> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Название — минимум 2 символа" };

  const { token, tokenHash, prefix } = generateToken();
  await prisma.apiToken.create({
    data: { userId: user.id, name: name.slice(0, 60), tokenHash, prefix },
  });
  revalidatePath("/profile");
  return { token };
}

export async function revokeApiTokenAction(id: string) {
  const user = await requireUser();
  const token = await prisma.apiToken.findUniqueOrThrow({ where: { id } });
  if (token.userId !== user.id) throw new Error("Можно отзывать только свои токены");
  await prisma.apiToken.delete({ where: { id } });
  revalidatePath("/profile");
}
