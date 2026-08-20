"use server";

import { prisma } from "@/lib/prisma";
import { rulePatch } from "@/lib/boardRules";
import {
  requireProjectMember,
  requireProjectManager,
  requireTaskMember,
} from "@/lib/access";
import { revalidatePath } from "next/cache";
import { recordStatusChange } from "@/lib/statusHistory";
import type { ColumnDTO } from "@/lib/types";
import type { ColumnSort } from "@prisma/client";

function toDto(c: {
  id: string;
  name: string;
  color: string;
  order: number;
  status: ColumnDTO["status"];
  wipLimit: number | null;
  sort: ColumnSort;
  hidden: boolean;
}): ColumnDTO {
  return {
    id: c.id,
    name: c.name,
    color: c.color,
    order: c.order,
    status: c.status,
    wipLimit: c.wipLimit,
    sort: c.sort,
    hidden: c.hidden,
  };
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
  fields: {
    name?: string;
    color?: string;
    wipLimit?: number | null;
    sort?: ColumnSort;
  }
) {
  const existing = await prisma.boardColumn.findUniqueOrThrow({
    where: { id: columnId },
    select: { projectId: true },
  });
  await requireProjectMember(existing.projectId);
  const wip =
    fields.wipLimit === undefined
      ? undefined
      : fields.wipLimit && fields.wipLimit > 0
        ? Math.floor(fields.wipLimit)
        : null;
  const column = await prisma.boardColumn.update({
    where: { id: columnId },
    data: {
      ...(fields.name !== undefined ? { name: fields.name.trim() } : {}),
      ...(fields.color !== undefined ? { color: fields.color } : {}),
      ...(wip !== undefined ? { wipLimit: wip } : {}),
      ...(fields.sort !== undefined ? { sort: fields.sort } : {}),
    },
  });
  revalidatePath(`/projects/${column.projectId}`);
}

/**
 * Прячет колонку с доски или возвращает её обратно. В отличие от удаления,
 * задачи остаются в колонке и появятся снова, как только её восстановят.
 * Последнюю видимую колонку скрыть нельзя — доска не осталась бы без колонок.
 */
export async function setBoardColumnHiddenAction(columnId: string, hidden: boolean) {
  const column = await prisma.boardColumn.findUniqueOrThrow({
    where: { id: columnId },
    select: { projectId: true },
  });
  await requireProjectMember(column.projectId);

  if (hidden) {
    const visible = await prisma.boardColumn.count({
      where: { projectId: column.projectId, hidden: false, id: { not: columnId } },
    });
    if (visible === 0) throw new Error("Нельзя скрыть последнюю колонку доски");
  }

  await prisma.boardColumn.update({ where: { id: columnId }, data: { hidden } });
  revalidatePath(`/projects/${column.projectId}`);
}

/**
 * Удаляет колонку доски (менеджер проекта, владелец или админ) — любую,
 * включая стандартную. Задачи не теряются: они переезжают в первую оставшуюся
 * колонку, статус при этом не меняется. Последнюю колонку удалить нельзя.
 */
export async function deleteBoardColumnAction(columnId: string) {
  const column = await prisma.boardColumn.findUniqueOrThrow({ where: { id: columnId } });
  await requireProjectManager(column.projectId);

  const rest = await prisma.boardColumn.findMany({
    where: { projectId: column.projectId, id: { not: columnId } },
    orderBy: { order: "asc" },
    select: { id: true, hidden: true },
  });
  if (rest.length === 0) {
    throw new Error("Нельзя удалить последнюю колонку доски");
  }
  // Переезжаем в первую видимую колонку, чтобы задачи не уехали в скрытую
  const target = rest.find((c) => !c.hidden) ?? rest[0]!;

  await prisma.$transaction([
    prisma.task.updateMany({
      where: {
        projectId: column.projectId,
        OR: [
          { columnId },
          // Карточки без явной колонки показывались здесь по своему статусу —
          // закрепляем и их, иначе после удаления они пропали бы с доски
          ...(column.status ? [{ columnId: null, status: column.status }] : []),
        ],
      },
      data: { columnId: target.id },
    }),
    prisma.boardColumn.delete({ where: { id: columnId } }),
  ]);
  revalidatePath(`/projects/${column.projectId}`);
}

/**
 * Перенос задачи в колонку. Если колонка привязана к статусу — статус задачи
 * обновляется; кастомные колонки статус не меняют.
 */
export async function moveTaskToColumnAction(taskId: string, columnId: string) {
  const { user, task: current } = await requireTaskMember(taskId);
  const column = await prisma.boardColumn.findUniqueOrThrow({ where: { id: columnId } });
  if (column.projectId !== current.projectId) {
    throw new Error("Колонка принадлежит другому проекту");
  }
  const before = column.status
    ? await prisma.task.findUnique({ where: { id: taskId }, select: { status: true } })
    : null;
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
  if (column.status && before) {
    await recordStatusChange(taskId, user.id, before.status, column.status);
  }
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
  const { user, task: current } = await requireTaskMember(taskId);
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
    select: { id: true, projectId: true, status: true },
  });
  if (tasks.some((t) => t.projectId !== column.projectId)) {
    throw new Error("Задача из другого проекта");
  }
  const beforeStatus = tasks.find((t) => t.id === taskId)?.status ?? null;

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
  // ── Правила доски ────────────────────────────────────────────────
  // Применяем после переноса: правило может поменять статус, назначить
  // исполнителя и повесить метку. Ошибка в правиле не должна отменять сам
  // перенос — карточка уже лежит в новой колонке.
  try {
    const rules = await prisma.boardRule.findMany({
      where: { projectId: column.projectId, columnId, active: true },
      orderBy: { createdAt: "asc" },
    });
    const patch = rulePatch(rules, columnId);
    if (patch.setStatus || patch.assignUserId || patch.addTagIds.length > 0) {
      await prisma.task.update({
        where: { id: taskId },
        data: {
          ...(patch.setStatus
            ? {
                status: patch.setStatus,
                closedAt:
                  patch.setStatus === "CLOSED" || patch.setStatus === "DONE"
                    ? new Date()
                    : null,
              }
            : {}),
          ...(patch.assignUserId
            ? { assignees: { connect: { id: patch.assignUserId } } }
            : {}),
          ...(patch.addTagIds.length > 0
            ? { tags: { connect: patch.addTagIds.map((id) => ({ id })) } }
            : {}),
        },
      });
    }
  } catch (e) {
    console.error("Правила доски:", e);
  }

  if (column.status && beforeStatus) {
    await recordStatusChange(taskId, user.id, beforeStatus, column.status);
  }
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
