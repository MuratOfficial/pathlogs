import { prisma } from "@/lib/prisma";
import { formatHours } from "@/lib/labels";

export type ActivityKind = "task" | "comment" | "patchlog" | "time";

export type Activity = {
  id: string;
  kind: ActivityKind;
  actor: string;
  at: Date;
  taskId: string;
  taskNumber: number;
  taskTitle: string;
  detail: string;
};

function trunc(s: string, n = 90): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
}

/**
 * Лента активности проекта — агрегирует из существующих данных:
 * созданные задачи, комментарии, патч-логи и записи времени.
 */
export async function getProjectActivity(
  projectId: string,
  limit = 40
): Promise<Activity[]> {
  const [tasks, comments, patchLogs, times] = await Promise.all([
    prisma.task.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        number: true,
        title: true,
        createdAt: true,
        creator: { select: { name: true } },
      },
    }),
    prisma.comment.findMany({
      where: { task: { projectId } },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        content: true,
        createdAt: true,
        author: { select: { name: true } },
        task: { select: { id: true, number: true, title: true } },
      },
    }),
    prisma.patchLog.findMany({
      where: { task: { projectId } },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        title: true,
        createdAt: true,
        author: { select: { name: true } },
        task: { select: { id: true, number: true, title: true } },
      },
    }),
    prisma.timeEntry.findMany({
      where: { task: { projectId } },
      orderBy: { date: "desc" },
      take: limit,
      select: {
        id: true,
        hours: true,
        date: true,
        user: { select: { name: true } },
        task: { select: { id: true, number: true, title: true } },
      },
    }),
  ]);

  const items: Activity[] = [
    ...tasks.map((t) => ({
      id: "task:" + t.id,
      kind: "task" as const,
      actor: t.creator?.name ?? "—",
      at: t.createdAt,
      taskId: t.id,
      taskNumber: t.number,
      taskTitle: t.title,
      detail: "создал(а) задачу",
    })),
    ...comments.map((c) => ({
      id: "comment:" + c.id,
      kind: "comment" as const,
      actor: c.author.name,
      at: c.createdAt,
      taskId: c.task.id,
      taskNumber: c.task.number,
      taskTitle: c.task.title,
      detail: "прокомментировал(а): " + trunc(c.content),
    })),
    ...patchLogs.map((p) => ({
      id: "patch:" + p.id,
      kind: "patchlog" as const,
      actor: p.author.name,
      at: p.createdAt,
      taskId: p.task.id,
      taskNumber: p.task.number,
      taskTitle: p.task.title,
      detail: "добавил(а) патч-лог: " + trunc(p.title),
    })),
    ...times.map((e) => ({
      id: "time:" + e.id,
      kind: "time" as const,
      actor: e.user.name,
      at: e.date,
      taskId: e.task.id,
      taskNumber: e.task.number,
      taskTitle: e.task.title,
      detail: "записал(а) " + formatHours(e.hours),
    })),
  ];

  items.sort((a, b) => b.at.getTime() - a.at.getTime());
  return items.slice(0, limit);
}
