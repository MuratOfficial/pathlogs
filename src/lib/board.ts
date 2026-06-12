import { prisma } from "@/lib/prisma";
import { KANBAN_COLUMNS, STATUS_COLORS, STATUS_LABELS } from "@/lib/labels";

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
