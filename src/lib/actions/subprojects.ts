"use server";

import { prisma } from "@/lib/prisma";
import { canAccessProject, requireTaskMember } from "@/lib/access";
import { ancestorProjectIds } from "@/lib/subprojects";
import { revalidatePath } from "next/cache";

/**
 * Привязывает проект к задаче как подзадачу.
 *
 * Проверяем оба конца связи: участие в проекте задачи даёт право её править,
 * а доступ к привязываемому проекту — право показать его в чужой карточке.
 */
export async function attachSubProjectAction(
  taskId: string,
  projectId: string
): Promise<{ error?: string }> {
  const { user, task } = await requireTaskMember(taskId);

  if (projectId === task.projectId) {
    return { error: "Проект нельзя привязать к задаче из него самого" };
  }
  if (!(await canAccessProject(projectId, user))) {
    return { error: "Нет доступа к этому проекту" };
  }
  // Проект-предок замкнул бы цепочку в кольцо
  if ((await ancestorProjectIds(task.projectId)).has(projectId)) {
    return { error: "Этот проект уже стоит выше по цепочке подзадач" };
  }

  await prisma.taskProjectLink.upsert({
    where: { taskId_projectId: { taskId, projectId } },
    update: {},
    create: { taskId, projectId },
  });

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath(`/projects/${projectId}`);
  return {};
}

/** Снимает привязку проекта к задаче. Сам проект остаётся нетронутым. */
export async function detachSubProjectAction(taskId: string, projectId: string) {
  await requireTaskMember(taskId);
  await prisma.taskProjectLink.deleteMany({ where: { taskId, projectId } });
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath(`/projects/${projectId}`);
}
