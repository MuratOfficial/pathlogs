"use server";

import { prisma } from "@/lib/prisma";
import { isManager, requireProjectMember, requireTaskMember } from "@/lib/access";
import { normalizeUrl } from "@/lib/url";
import { revalidatePath } from "next/cache";

const MAX_TITLE = 120;
const MAX_DESCRIPTION = 1000;

function clean(value: FormDataEntryValue | null, max: number): string | null {
  const s = String(value ?? "").trim();
  return s ? s.slice(0, max) : null;
}

/**
 * Добавляет ссылку в проект (taskId пустой) или в задачу.
 * Может любой участник проекта. Обязателен только адрес.
 */
export async function addResourceLinkAction(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const projectId = String(formData.get("projectId") ?? "");
  const taskId = String(formData.get("taskId") ?? "") || null;
  if (!projectId) return { error: "Не указан проект" };

  const user = taskId
    ? (await requireTaskMember(taskId)).user
    : await requireProjectMember(projectId);

  // Задача должна принадлежать этому же проекту
  if (taskId) {
    const task = await prisma.task.findUniqueOrThrow({
      where: { id: taskId },
      select: { projectId: true },
    });
    if (task.projectId !== projectId) return { error: "Задача из другого проекта" };
  }

  const url = normalizeUrl(String(formData.get("url") ?? ""));
  if (!url) return { error: "Укажите корректный адрес (http:// или https://)" };

  await prisma.resourceLink.create({
    data: {
      projectId,
      taskId,
      url,
      title: clean(formData.get("title"), MAX_TITLE),
      description: clean(formData.get("description"), MAX_DESCRIPTION),
      authorId: user.id,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  if (taskId) revalidatePath(`/tasks/${taskId}`);
  return {};
}

/** Автор ссылки или менеджер проекта — иначе ошибка. */
async function requireLinkEditor(linkId: string) {
  const link = await prisma.resourceLink.findUniqueOrThrow({
    where: { id: linkId },
    select: { id: true, projectId: true, taskId: true, authorId: true },
  });
  const user = await requireProjectMember(link.projectId);
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: link.projectId },
    select: { ownerId: true },
  });
  const allowed =
    link.authorId === user.id || project.ownerId === user.id || isManager(user);
  if (!allowed) {
    throw new Error("Изменять ссылку может её автор или менеджер проекта");
  }
  return link;
}

export async function updateResourceLinkAction(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Ссылка не найдена" };
  const link = await requireLinkEditor(id);

  const url = normalizeUrl(String(formData.get("url") ?? ""));
  if (!url) return { error: "Укажите корректный адрес (http:// или https://)" };

  await prisma.resourceLink.update({
    where: { id },
    data: {
      url,
      title: clean(formData.get("title"), MAX_TITLE),
      description: clean(formData.get("description"), MAX_DESCRIPTION),
    },
  });

  revalidatePath(`/projects/${link.projectId}`);
  if (link.taskId) revalidatePath(`/tasks/${link.taskId}`);
  return {};
}

export async function deleteResourceLinkAction(linkId: string) {
  const link = await requireLinkEditor(linkId);
  await prisma.resourceLink.delete({ where: { id: linkId } });
  revalidatePath(`/projects/${link.projectId}`);
  if (link.taskId) revalidatePath(`/tasks/${link.taskId}`);
}
