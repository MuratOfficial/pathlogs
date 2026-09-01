"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/auth";
import {
  getUserCompanyId,
  requireProjectManager,
  requireProjectMember,
} from "@/lib/access";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import { z } from "zod";
import { HEX_COLOR, type ProjectBackgroundDTO } from "@/lib/background";

const projectSchema = z.object({
  name: z.string().min(2, "Название — минимум 2 символа"),
  key: z
    .string()
    .min(2)
    .max(6)
    .regex(/^[A-Za-z]+$/, "Ключ — только латинские буквы"),
  description: z.string().optional(),
});

/** Персональный фон проекта: основной цвет, второй цвет градиента и угол. */
const backgroundSchema = z.object({
  color: z.string().regex(HEX_COLOR, "Цвет — в формате #rrggbb"),
  colorTo: z.string().regex(HEX_COLOR, "Цвет — в формате #rrggbb").nullable(),
  angle: z.coerce.number().int().min(0).max(360),
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

  // Проект наследует компанию создателя: так он сразу попадает в её контур
  // видимости. У пользователя без компании проект остаётся вне контуров.
  const project = await prisma.project.create({
    data: {
      name: parsed.data.name,
      key,
      description: parsed.data.description,
      ownerId: user.id,
      companyId: await getUserCompanyId(user.id),
      members: { create: { userId: user.id } },
    },
  });

  revalidatePath("/dashboard");
  redirect(`/projects/${project.id}`);
}

/**
 * Редактирует название, ключ и описание проекта.
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
    },
  });

  revalidatePath("/dashboard");
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

/**
 * Задаёт персональный фон проекта текущему пользователю (null — убрать фон).
 * Фон личный: другие участники продолжают видеть свой, поэтому прав менеджера
 * не требуется — достаточно быть участником проекта.
 */
export async function setProjectBackgroundAction(
  projectId: string,
  background: ProjectBackgroundDTO | null
): Promise<{ error?: string }> {
  const user = await requireProjectMember(projectId);

  if (!background) {
    await prisma.projectAppearance.deleteMany({ where: { userId: user.id, projectId } });
  } else {
    const parsed = backgroundSchema.safeParse(background);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Некорректный цвет" };
    }
    const { color, colorTo, angle } = parsed.data;
    await prisma.projectAppearance.upsert({
      where: { userId_projectId: { userId: user.id, projectId } },
      update: { color, colorTo, angle },
      create: { userId: user.id, projectId, color, colorTo, angle },
    });
  }

  revalidatePath("/dashboard");
  revalidatePath(`/projects/${projectId}`);
  return {};
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

/**
 * Добавляет участника. Из чужой компании человека в проект не пустить —
 * иначе через состав проекта можно было бы обойти разделение по компаниям.
 */
export async function addProjectMemberAction(projectId: string, userId: string) {
  await requireProjectManager(projectId);
  const [target, project] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { active: true, companyId: true },
    }),
    prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { companyId: true },
    }),
  ]);
  if (!target.active) throw new Error("Пользователь деактивирован");
  if (project.companyId && project.companyId !== target.companyId) {
    throw new Error("Пользователь из другой компании");
  }
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
