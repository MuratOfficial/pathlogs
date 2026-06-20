"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/auth";
import { requireProjectManager } from "@/lib/access";
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
