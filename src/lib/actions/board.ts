"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/auth";
import { revalidatePath } from "next/cache";
import type { ColumnDTO } from "@/lib/types";

function toDto(c: {
  id: string;
  name: string;
  color: string;
  order: number;
  status: ColumnDTO["status"];
}): ColumnDTO {
  return { id: c.id, name: c.name, color: c.color, order: c.order, status: c.status };
}

export async function createBoardColumnAction(
  projectId: string,
  name: string,
  color: string
): Promise<{ column?: ColumnDTO; error?: string }> {
  await requireUser();
  const trimmed = name.trim();
  if (trimmed.length < 1) return { error: "Укажите название колонки" };

  const last = await prisma.boardColumn.aggregate({
    where: { projectId },
    _max: { order: true },
  });
  const column = await prisma.boardColumn.create({
    data: {
      projectId,
      name: trimmed,
      color,
      order: (last._max.order ?? 0) + 10,
    },
  });
  revalidatePath(`/projects/${projectId}`);
  return { column: toDto(column) };
}

export async function updateBoardColumnAction(
  columnId: string,
  fields: { name?: string; color?: string }
) {
  await requireUser();
  const column = await prisma.boardColumn.update({
    where: { id: columnId },
    data: {
      ...(fields.name !== undefined ? { name: fields.name.trim() } : {}),
      ...(fields.color !== undefined ? { color: fields.color } : {}),
    },
  });
  revalidatePath(`/projects/${column.projectId}`);
}

/** Удалять можно только кастомные колонки; задачи из них возвращаются в колонку своего статуса. */
export async function deleteBoardColumnAction(columnId: string) {
  await requireUser();
  const column = await prisma.boardColumn.findUniqueOrThrow({ where: { id: columnId } });
  if (column.status) throw new Error("Стандартную колонку удалить нельзя");
  await prisma.boardColumn.delete({ where: { id: columnId } });
  revalidatePath(`/projects/${column.projectId}`);
}

/**
 * Перенос задачи в колонку. Если колонка привязана к статусу — статус задачи
 * обновляется; кастомные колонки статус не меняют.
 */
export async function moveTaskToColumnAction(taskId: string, columnId: string) {
  await requireUser();
  const column = await prisma.boardColumn.findUniqueOrThrow({ where: { id: columnId } });
  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      columnId,
      ...(column.status
        ? {
            status: column.status,
            closedAt:
              column.status === "CLOSED" || column.status === "DONE" ? new Date() : null,
          }
        : {}),
    },
  });
  revalidatePath(`/projects/${task.projectId}`);
  revalidatePath(`/tasks/${taskId}`);
}

export async function updateTaskColorAction(taskId: string, color: string | null) {
  await requireUser();
  const task = await prisma.task.update({
    where: { id: taskId },
    data: { color },
  });
  revalidatePath(`/projects/${task.projectId}`);
  revalidatePath(`/tasks/${taskId}`);
}
