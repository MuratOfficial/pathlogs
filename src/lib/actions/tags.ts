"use server";

import { prisma } from "@/lib/prisma";
import {
  requireProjectManager,
  requireProjectMember,
  requireTaskMember,
} from "@/lib/access";
import type { TagDTO } from "@/lib/types";
import { revalidatePath } from "next/cache";

const MAX_TAGS_PER_PROJECT = 60;
const HEX = /^#[0-9a-fA-F]{6}$/;

function normalizeName(raw: string) {
  return raw.trim().replace(/\s+/g, " ").slice(0, 30);
}

/**
 * Создаёт метку проекта (или возвращает уже существующую с таким именем).
 * Создавать метки может любой участник проекта.
 */
export async function createTagAction(
  projectId: string,
  name: string,
  color: string
): Promise<{ tag?: TagDTO; error?: string }> {
  await requireProjectMember(projectId);
  const clean = normalizeName(name);
  if (clean.length < 1) return { error: "Название метки не может быть пустым" };
  if (!HEX.test(color)) return { error: "Некорректный цвет" };

  const existing = await prisma.tag.findUnique({
    where: { projectId_name: { projectId, name: clean } },
    select: { id: true, name: true, color: true },
  });
  if (existing) return { tag: existing };

  const count = await prisma.tag.count({ where: { projectId } });
  if (count >= MAX_TAGS_PER_PROJECT) {
    return { error: `В проекте не может быть больше ${MAX_TAGS_PER_PROJECT} меток` };
  }

  const tag = await prisma.tag.create({
    data: { projectId, name: clean, color },
    select: { id: true, name: true, color: true },
  });
  revalidatePath(`/projects/${projectId}`);
  return { tag };
}

/** Переименование / перекраска метки. Только менеджер проекта. */
export async function updateTagAction(
  tagId: string,
  fields: { name?: string; color?: string }
): Promise<{ error?: string }> {
  const tag = await prisma.tag.findUniqueOrThrow({
    where: { id: tagId },
    select: { projectId: true },
  });
  await requireProjectManager(tag.projectId);

  const name = fields.name !== undefined ? normalizeName(fields.name) : undefined;
  if (name !== undefined && name.length < 1) {
    return { error: "Название метки не может быть пустым" };
  }
  if (fields.color !== undefined && !HEX.test(fields.color)) {
    return { error: "Некорректный цвет" };
  }
  if (name !== undefined) {
    const clash = await prisma.tag.findUnique({
      where: { projectId_name: { projectId: tag.projectId, name } },
      select: { id: true },
    });
    if (clash && clash.id !== tagId) return { error: `Метка «${name}» уже есть` };
  }

  await prisma.tag.update({
    where: { id: tagId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(fields.color !== undefined ? { color: fields.color } : {}),
    },
  });
  revalidatePath(`/projects/${tag.projectId}`);
  return {};
}

/** Удаляет метку из проекта и со всех его задач. Только менеджер проекта. */
export async function deleteTagAction(tagId: string) {
  const tag = await prisma.tag.findUniqueOrThrow({
    where: { id: tagId },
    select: { projectId: true },
  });
  await requireProjectManager(tag.projectId);
  await prisma.tag.delete({ where: { id: tagId } });
  revalidatePath(`/projects/${tag.projectId}`);
}

/**
 * Задаёт полный набор меток задачи. Чужие метки (из других проектов)
 * молча отбрасываются — назначить можно только метки своего проекта.
 */
export async function setTaskTagsAction(taskId: string, tagIds: string[]) {
  const { task } = await requireTaskMember(taskId);
  const allowed = tagIds.length
    ? await prisma.tag.findMany({
        where: { id: { in: tagIds }, projectId: task.projectId },
        select: { id: true },
      })
    : [];
  await prisma.task.update({
    where: { id: taskId },
    data: { tags: { set: allowed.map((t) => ({ id: t.id })) } },
  });
  revalidatePath(`/projects/${task.projectId}`);
  revalidatePath(`/tasks/${taskId}`);
}
