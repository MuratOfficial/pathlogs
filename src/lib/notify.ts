import { prisma } from "@/lib/prisma";
import { deliverProjectEvent } from "@/lib/webhooks";
import type { NotificationType } from "@prisma/client";

/**
 * Уведомляет «наблюдателей» задачи — исполнителей и автора, кроме инициатора.
 * Параллельно рассылает событие в исходящие вебхуки проекта (Slack/Telegram).
 * Ошибки уведомлений не должны ронять основное действие.
 */
export async function notifyTaskWatchers(
  taskId: string,
  actorId: string,
  type: NotificationType,
  message: string,
  onlyUserIds?: string[],
  excludeUserIds?: string[]
) {
  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true, creatorId: true, assignees: { select: { id: true } } },
    });
    if (!task) return;
    await deliverProjectEvent(task.projectId, message);
    let ids = new Set([task.creatorId, ...task.assignees.map((a) => a.id)]);
    if (onlyUserIds) ids = new Set(onlyUserIds.filter((id) => ids.has(id)));
    ids.delete(actorId);
    for (const id of excludeUserIds ?? []) ids.delete(id);
    if (ids.size === 0) return;
    await prisma.notification.createMany({
      data: [...ids].map((userId) => ({ userId, taskId, type, message })),
    });
  } catch (e) {
    console.error("notifyTaskWatchers:", e);
  }
}

/** Уведомляет конкретных пользователей (например, новых исполнителей). */
export async function notifyUsers(
  userIds: string[],
  actorId: string,
  taskId: string | null,
  type: NotificationType,
  message: string
) {
  const ids = [...new Set(userIds)].filter((id) => id !== actorId);
  if (ids.length === 0) return;
  try {
    await prisma.notification.createMany({
      data: ids.map((userId) => ({ userId, taskId, type, message })),
    });
  } catch (e) {
    console.error("notifyUsers:", e);
  }
}
