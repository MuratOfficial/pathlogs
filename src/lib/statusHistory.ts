import { prisma } from "@/lib/prisma";
import type { TaskStatus } from "@prisma/client";

/**
 * Записывает переход статуса задачи в историю (для «машины времени»).
 * Ничего не делает, если статус не изменился.
 */
export async function recordStatusChange(
  taskId: string,
  userId: string | null,
  from: TaskStatus | null,
  to: TaskStatus
): Promise<void> {
  if (from === to) return;
  await prisma.taskStatusEvent.create({
    data: { taskId, userId, fromStatus: from, toStatus: to },
  });
}
