import { prisma } from "@/lib/prisma";

/**
 * Вклад пользователя по дням — для календарной теплокарты на профиле.
 *
 * Считаем из того, что уже пишется: патч-логи, комментарии, созданные
 * задачи, записи времени и переводы статуса. Отдельной таблицы событий нет и
 * заводить её незачем — она была бы копией этих пяти с риском разойтись.
 */

/** Дата в YYYY-MM-DD по локальному времени — как ждёт HeatmapCalendar. */
function isoDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type Contributions = {
  /** `{ "2026-02-14": 3 }` — сколько действий в этот день. */
  values: Record<string, number>;
  from: Date;
  to: Date;
  total: number;
};

/**
 * Активность за последние `days` дней.
 *
 * Пять запросов вместо одного склеенного: Prisma не умеет union, а сырой SQL
 * здесь читался бы хуже и привязал бы код к Postgres. Выборки узкие — только
 * дата, — поэтому дешёвые даже на большой истории.
 */
export async function getContributions(
  userId: string,
  days = 365,
  now: Date = new Date()
): Promise<Contributions> {
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  const from = new Date(to);
  from.setDate(from.getDate() - (days - 1));
  from.setHours(0, 0, 0, 0);

  const range = { gte: from, lte: to };

  const [patchLogs, comments, tasks, times, moves] = await Promise.all([
    prisma.patchLog.findMany({
      where: { authorId: userId, createdAt: range },
      select: { createdAt: true },
    }),
    prisma.comment.findMany({
      where: { authorId: userId, createdAt: range },
      select: { createdAt: true },
    }),
    prisma.task.findMany({
      where: { creatorId: userId, createdAt: range },
      select: { createdAt: true },
    }),
    prisma.timeEntry.findMany({
      where: { userId, date: range },
      select: { date: true },
    }),
    prisma.taskStatusEvent.findMany({
      where: { userId, at: range },
      select: { at: true },
    }),
  ]);

  const values: Record<string, number> = {};
  const add = (date: Date) => {
    const key = isoDay(date);
    values[key] = (values[key] ?? 0) + 1;
  };

  for (const r of patchLogs) add(r.createdAt);
  for (const r of comments) add(r.createdAt);
  for (const r of tasks) add(r.createdAt);
  for (const r of times) add(r.date);
  for (const r of moves) add(r.at);

  const total = Object.values(values).reduce((sum, n) => sum + n, 0);
  return { values, from, to, total };
}
