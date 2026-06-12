"use server";

import { prisma } from "@/lib/prisma";
import {
  requireProjectMember,
  requireProjectManager,
  requireTaskMember,
} from "@/lib/access";
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
  await requireProjectMember(projectId);
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
  const existing = await prisma.boardColumn.findUniqueOrThrow({
    where: { id: columnId },
    select: { projectId: true },
  });
  await requireProjectMember(existing.projectId);
  const column = await prisma.boardColumn.update({
    where: { id: columnId },
    data: {
      ...(fields.name !== undefined ? { name: fields.name.trim() } : {}),
      ...(fields.color !== undefined ? { color: fields.color } : {}),
    },
  });
  revalidatePath(`/projects/${column.projectId}`);
}

/**
 * Удалять можно только кастомные колонки (менеджер проекта, владелец или админ);
 * задачи из них возвращаются в колонку своего статуса.
 */
export async function deleteBoardColumnAction(columnId: string) {
  const column = await prisma.boardColumn.findUniqueOrThrow({ where: { id: columnId } });
  await requireProjectManager(column.projectId);
  if (column.status) throw new Error("Стандартную колонку удалить нельзя");
  await prisma.boardColumn.delete({ where: { id: columnId } });
  revalidatePath(`/projects/${column.projectId}`);
}

/**
 * Перенос задачи в колонку. Если колонка привязана к статусу — статус задачи
 * обновляется; кастомные колонки статус не меняют.
 */
export async function moveTaskToColumnAction(taskId: string, columnId: string) {
  const { task: current } = await requireTaskMember(taskId);
  const column = await prisma.boardColumn.findUniqueOrThrow({ where: { id: columnId } });
  if (column.projectId !== current.projectId) {
    throw new Error("Колонка принадлежит другому проекту");
  }
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

/**
 * Перенос задачи с учётом позиции внутри колонки. `orderedTaskIds` — итоговый
 * порядок карточек целевой колонки (включая переносимую). Перенесённой задаче
 * выставляется колонка/статус, остальным — только новый `order`.
 */
export async function moveTaskAction(
  taskId: string,
  columnId: string,
  orderedTaskIds: string[]
) {
  const { task: current } = await requireTaskMember(taskId);
  const column = await prisma.boardColumn.findUniqueOrThrow({ where: { id: columnId } });
  if (column.projectId !== current.projectId) {
    throw new Error("Колонка принадлежит другому проекту");
  }
  // Все переупорядочиваемые задачи должны быть из того же проекта
  const ids = orderedTaskIds.includes(taskId)
    ? orderedTaskIds
    : [...orderedTaskIds, taskId];
  const tasks = await prisma.task.findMany({
    where: { id: { in: ids } },
    select: { id: true, projectId: true },
  });
  if (tasks.some((t) => t.projectId !== column.projectId)) {
    throw new Error("Задача из другого проекта");
  }

  await prisma.$transaction(
    ids.map((id, i) =>
      id === taskId
        ? prisma.task.update({
            where: { id },
            data: {
              order: i,
              columnId,
              ...(column.status
                ? {
                    status: column.status,
                    closedAt:
                      column.status === "CLOSED" || column.status === "DONE"
                        ? new Date()
                        : null,
                  }
                : {}),
            },
          })
        : prisma.task.update({ where: { id }, data: { order: i } })
    )
  );
  revalidatePath(`/projects/${column.projectId}`);
  revalidatePath(`/tasks/${taskId}`);
}

/** Перестановка колонок доски. `orderedColumnIds` — новый порядок слева направо. */
export async function reorderColumnsAction(
  projectId: string,
  orderedColumnIds: string[]
) {
  await requireProjectMember(projectId);
  const cols = await prisma.boardColumn.findMany({
    where: { id: { in: orderedColumnIds } },
    select: { id: true, projectId: true },
  });
  if (cols.some((c) => c.projectId !== projectId)) {
    throw new Error("Колонка из другого проекта");
  }
  await prisma.$transaction(
    orderedColumnIds.map((id, i) =>
      prisma.boardColumn.update({ where: { id }, data: { order: (i + 1) * 10 } })
    )
  );
  revalidatePath(`/projects/${projectId}`);
}

export async function updateTaskColorAction(taskId: string, color: string | null) {
  await requireTaskMember(taskId);
  const task = await prisma.task.update({
    where: { id: taskId },
    data: { color },
  });
  revalidatePath(`/projects/${task.projectId}`);
  revalidatePath(`/tasks/${taskId}`);
}
