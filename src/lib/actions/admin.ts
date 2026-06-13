"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/auth";
import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";

export async function setUserRoleAction(userId: string, role: Role) {
  const admin = await requireAdmin();
  if (admin.id === userId) throw new Error("Нельзя менять собственную роль");
  await prisma.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/admin");
}

export async function setUserRateAction(userId: string, rate: number | null) {
  await requireAdmin();
  const value = rate != null && rate > 0 ? rate : null;
  await prisma.user.update({ where: { id: userId }, data: { hourlyRate: value } });
  revalidatePath("/admin");
}

export async function toggleUserActiveAction(userId: string) {
  const admin = await requireAdmin();
  if (admin.id === userId) throw new Error("Нельзя деактивировать самого себя");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  await prisma.user.update({
    where: { id: userId },
    data: { active: !user.active },
  });
  revalidatePath("/admin");
}

export async function createUserAction(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "DEVELOPER") as Role;

  if (name.length < 2) return { error: "Имя — минимум 2 символа" };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Некорректный email" };
  if (password.length < 6) return { error: "Пароль — минимум 6 символов" };

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return { error: "Пользователь с таким email уже существует" };

  await prisma.user.create({
    data: { name, email, passwordHash: await bcrypt.hash(password, 12), role },
  });
  revalidatePath("/admin");
  return {};
}
