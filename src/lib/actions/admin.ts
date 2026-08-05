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

/**
 * Редактирование пользователя админом: имя, email, роль, ставка, активность.
 * Собственные роль и активность админ менять не может — чтобы не запереть себя.
 */
export async function updateUserAction(
  userId: string,
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const admin = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const role = String(formData.get("role") ?? "") as Role;
  const rateRaw = String(formData.get("hourlyRate") ?? "").replace(",", ".").trim();
  const active = formData.get("active") === "on";

  if (name.length < 2) return { error: "Имя — минимум 2 символа" };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Некорректный email" };
  if (!["ADMIN", "MANAGER", "ANALYST", "DEVELOPER"].includes(role)) {
    return { error: "Некорректная роль" };
  }
  const rate = rateRaw ? Number(rateRaw) : null;
  if (rate !== null && (!Number.isFinite(rate) || rate < 0)) {
    return { error: "Ставка должна быть положительным числом" };
  }

  const clash = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (clash && clash.id !== userId) {
    return { error: "Этот email уже занят другим пользователем" };
  }

  const isSelf = admin.id === userId;
  await prisma.user.update({
    where: { id: userId },
    data: {
      name,
      email,
      hourlyRate: rate !== null && rate > 0 ? rate : null,
      // Себе роль и активность менять нельзя — иначе можно потерять доступ
      ...(isSelf ? {} : { role, active }),
    },
  });
  revalidatePath("/admin");
  return { ok: true };
}

/**
 * Сброс пароля пользователя администратором.
 * Новый пароль задаёт админ и передаёт пользователю сам —
 * почтовой рассылки паролей здесь нет намеренно.
 */
export async function resetUserPasswordAction(
  userId: string,
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  await requireAdmin();
  const password = String(formData.get("password") ?? "");
  const repeat = String(formData.get("password2") ?? "");
  if (password.length < 6) return { error: "Пароль — минимум 6 символов" };
  if (password !== repeat) return { error: "Пароли не совпадают" };

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(password, 12) },
  });
  revalidatePath("/admin");
  return { ok: true };
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
