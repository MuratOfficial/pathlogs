"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/auth";
import { canManageProject, requireProjectMember } from "@/lib/access";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const sprintSchema = z
  .object({
    projectId: z.string().min(1),
    name: z.string().trim().min(2, "Название — минимум 2 символа").max(80),
    goal: z.string().trim().max(500).optional(),
    startsAt: z.string().min(1, "Укажите дату начала"),
    endsAt: z.string().min(1, "Укажите дату окончания"),
  })
  .refine((v) => new Date(v.endsAt) >= new Date(v.startsAt), {
    message: "Спринт не может закончиться раньше, чем начался",
    path: ["endsAt"],
  });

async function requireManager(projectId: string) {
  const user = await requireUser();
  if (!(await canManageProject(projectId, user))) {
    throw new Error("Управлять спринтами может владелец или менеджер проекта");
  }
  return user;
}

export async function createSprintAction(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const parsed = sprintSchema.safeParse({
    projectId: formData.get("projectId"),
    name: formData.get("name"),
    goal: formData.get("goal") || undefined,
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Проверьте поля" };
  }
  const { projectId, name, goal, startsAt, endsAt } = parsed.data;
  await requireManager(projectId);

  await prisma.sprint.create({
    data: {
      projectId,
      name,
      goal: goal ?? null,
      startsAt: new Date(startsAt),
      // Спринт заканчивается концом дня, а не полуночью в его начале —
      // иначе последний день выпадал бы из расчёта
      endsAt: new Date(new Date(endsAt).setHours(23, 59, 59, 999)),
    },
  });
  revalidatePath(`/projects/${projectId}`);
  return {};
}

export async function closeSprintAction(sprintId: string) {
  const sprint = await prisma.sprint.findUniqueOrThrow({
    where: { id: sprintId },
    select: { projectId: true, closedAt: true },
  });
  await requireManager(sprint.projectId);
  await prisma.sprint.update({
    where: { id: sprintId },
    // Повторное нажатие открывает спринт обратно: закрыть по ошибке легко
    data: { closedAt: sprint.closedAt ? null : new Date() },
  });
  revalidatePath(`/projects/${sprint.projectId}`);
}

export async function deleteSprintAction(sprintId: string) {
  const sprint = await prisma.sprint.findUniqueOrThrow({
    where: { id: sprintId },
    select: { projectId: true },
  });
  await requireManager(sprint.projectId);
  // Задачи не удаляем — они просто выходят из спринта (onDelete: SetNull)
  await prisma.sprint.delete({ where: { id: sprintId } });
  revalidatePath(`/projects/${sprint.projectId}`);
}

/** Добавляет задачи в спринт или убирает их из него (sprintId = null). */
export async function setTasksSprintAction(taskIds: string[], sprintId: string | null) {
  const ids = [...new Set(taskIds)].slice(0, 200);
  if (ids.length === 0) return { updated: 0 };

  const first = await prisma.task.findUniqueOrThrow({
    where: { id: ids[0]! },
    select: { projectId: true },
  });
  await requireProjectMember(first.projectId);

  if (sprintId) {
    const sprint = await prisma.sprint.findFirst({
      where: { id: sprintId, projectId: first.projectId },
      select: { id: true, closedAt: true },
    });
    // Чужой или закрытый спринт задачи не принимает
    if (!sprint || sprint.closedAt) {
      throw new Error("Спринт закрыт или принадлежит другому проекту");
    }
  }

  const res = await prisma.task.updateMany({
    // projectId в условии — задача из другого проекта в спринт не попадёт
    where: { id: { in: ids }, projectId: first.projectId },
    data: { sprintId },
  });
  revalidatePath(`/projects/${first.projectId}`);
  return { updated: res.count };
}
