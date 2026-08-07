import { prisma } from "@/lib/prisma";
import { KANBAN_COLUMNS, STATUS_COLORS, STATUS_LABELS } from "@/lib/labels";
import type { TaskStatus } from "@prisma/client";

/**
 * Гарантирует наличие стандартных колонок доски у проекта
 * (для проектов, созданных до появления кастомных колонок).
 */
export async function ensureDefaultColumns(projectId: string) {
  const count = await prisma.boardColumn.count({ where: { projectId } });
  if (count > 0) return;
  await prisma.boardColumn.createMany({
    data: KANBAN_COLUMNS.map((status, i) => ({
      projectId,
      name: STATUS_LABELS[status],
      color: STATUS_COLORS[status],
      status,
      order: (i + 1) * 10,
    })),
  });
}

/**
 * Видимая колонка проекта для статуса — место, куда попадает задача, созданная
 * без явного выбора колонки. Колонки может не быть: её удалили или скрыли.
 * Тогда восстанавливаем: скрытую показываем обратно, отсутствующую создаём
 * заново. Иначе задача осталась бы без колонки и пропала бы с доски.
 */
export async function ensureStatusColumn(
  projectId: string,
  status: TaskStatus
): Promise<string> {
  const visible = await prisma.boardColumn.findFirst({
    where: { projectId, status, hidden: false },
    orderBy: { order: "asc" },
    select: { id: true },
  });
  if (visible) return visible.id;

  const hidden = await prisma.boardColumn.findFirst({
    where: { projectId, status, hidden: true },
    orderBy: { order: "asc" },
    select: { id: true },
  });
  if (hidden) {
    await prisma.boardColumn.update({
      where: { id: hidden.id },
      data: { hidden: false },
    });
    return hidden.id;
  }

  // Колонку удалили — создаём стандартную заново перед остальными
  const first = await prisma.boardColumn.aggregate({
    where: { projectId },
    _min: { order: true },
  });
  const created = await prisma.boardColumn.create({
    data: {
      projectId,
      name: STATUS_LABELS[status],
      color: STATUS_COLORS[status],
      status,
      order: (first._min.order ?? 10) - 10,
    },
    select: { id: true },
  });
  return created.id;
}
