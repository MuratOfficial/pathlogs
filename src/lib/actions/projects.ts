"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/auth";
import { requireProjectManager, requireProjectMember } from "@/lib/access";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import { z } from "zod";

const projectSchema = z.object({
  name: z.string().min(2, "Название — минимум 2 символа"),
  key: z
    .string()
    .min(2)
    .max(6)
    .regex(/^[A-Za-z]+$/, "Ключ — только латинские буквы"),
  description: z.string().optional(),
  /// Пустая строка — «без цвета», фон остаётся обычным
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Цвет — в формате #rrggbb")
    .optional(),
});

export async function createProjectAction(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const user = await requireUser();
  const parsed = projectSchema.safeParse({
    name: formData.get("name"),
    key: formData.get("key"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  const key = parsed.data.key.toUpperCase();
  const exists = await prisma.project.findUnique({ where: { key } });
  if (exists) return { error: `Ключ «${key}» уже занят` };

  const project = await prisma.project.create({
    data: {
      name: parsed.data.name,
      key,
      description: parsed.data.description,
      ownerId: user.id,
      members: { create: { userId: user.id } },
    },
  });

  revalidatePath("/dashboard");
  redirect(`/projects/${project.id}`);
}

/**
 * Редактирует название, ключ, описание и фоновый цвет проекта.
 * Доступно владельцу, админу и менеджеру проекта (см. requireProjectManager).
 */
export async function updateProjectAction(
  projectId: string,
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  await requireProjectManager(projectId);
  const parsed = projectSchema.safeParse({
    name: formData.get("name"),
    key: formData.get("key"),
    description: formData.get("description") || undefined,
    color: formData.get("color") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  const key = parsed.data.key.toUpperCase();
  const clash = await prisma.project.findUnique({
    where: { key },
    select: { id: true },
  });
  if (clash && clash.id !== projectId) return { error: `Ключ «${key}» уже занят` };

  await prisma.project.update({
    where: { id: projectId },
    data: {
      name: parsed.data.name,
      key,
      description: parsed.data.description ?? null,
      color: parsed.data.color ?? null,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

/**
 * Закрепляет проект в боковом меню текущего пользователя (или снимает закрепление).
 * Закрепление персональное: каждый видит только свои проекты.
 */
export async function toggleProjectPinAction(
  projectId: string
): Promise<{ pinned: boolean }> {
  const user = await requireProjectMember(projectId);
  const existing = await prisma.projectPin.findUnique({
    where: { userId_projectId: { userId: user.id, projectId } },
    select: { id: true },
  });
  if (existing) {
    await prisma.projectPin.delete({ where: { id: existing.id } });
  } else {
    await prisma.projectPin.create({ data: { userId: user.id, projectId } });
  }
  revalidatePath("/dashboard");
  revalidatePath(`/projects/${projectId}`);
  return { pinned: !existing };
}

export async function toggleProjectArchiveAction(projectId: string) {
  await requireProjectManager(projectId);
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  await prisma.project.update({
    where: { id: projectId },
    data: { status: project.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE" },
  });
  revalidatePath("/dashboard");
  revalidatePath(`/projects/${projectId}`);
}

/**
 * Включает/выключает публичную read-only ссылку на роадмап проекта.
 * Возвращает новый токен (или null, если выключили). Только менеджер+.
 */
export async function togglePublicRoadmapAction(
  projectId: string
): Promise<{ token: string | null }> {
  await requireProjectManager(projectId);
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { publicToken: true },
  });
  const token = project.publicToken ? null : randomBytes(16).toString("hex");
  await prisma.project.update({
    where: { id: projectId },
    data: { publicToken: token },
  });
  revalidatePath(`/projects/${projectId}`);
  return { token };
}

export async function addProjectMemberAction(projectId: string, userId: string) {
  await requireProjectManager(projectId);
  const target = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { active: true },
  });
  if (!target.active) throw new Error("Пользователь деактивирован");
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId } },
    update: {},
    create: { projectId, userId },
  });
  revalidatePath(`/projects/${projectId}`);
}

export async function removeProjectMemberAction(projectId: string, userId: string) {
  await requireProjectManager(projectId);
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { ownerId: true },
  });
  if (project.ownerId === userId) {
    throw new Error("Владельца проекта исключить нельзя");
  }
  await prisma.projectMember.deleteMany({ where: { projectId, userId } });
  revalidatePath(`/projects/${projectId}`);
}
