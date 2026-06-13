"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/auth";
import { requireProjectMember } from "@/lib/access";
import { revalidatePath } from "next/cache";

/** Сохранить набор фильтров списка задач (на пользователя и проект). */
export async function saveFilterAction(projectId: string, name: string, query: string) {
  const user = await requireProjectMember(projectId);
  const trimmed = name.trim();
  if (trimmed.length < 1) return;
  await prisma.savedFilter.create({
    data: { userId: user.id, projectId, name: trimmed.slice(0, 60), query },
  });
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteFilterAction(id: string) {
  const user = await requireUser();
  const filter = await prisma.savedFilter.findUniqueOrThrow({ where: { id } });
  if (filter.userId !== user.id) throw new Error("Можно удалять только свои фильтры");
  await prisma.savedFilter.delete({ where: { id } });
  revalidatePath(`/projects/${filter.projectId}`);
}
