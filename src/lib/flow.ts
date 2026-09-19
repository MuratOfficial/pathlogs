import type { TaskStatus } from "@prisma/client";

/**
 * Метрики потока: сколько задача на самом деле идёт от начала работы до
 * готовности и где застревает.
 *
 * Считаются по TaskStatusEvent — журналу переходов, который проект ведёт с
 * самого начала, но читает только лента одной задачи. Ничего досчитывать и
 * мигрировать не нужно: история уже есть.
 *
 * Модуль намеренно чистый (никакого prisma) — весь разбор идёт над готовым
 * массивом событий, поэтому проверяется тестами без базы.
 */

/** Переход статуса, как его отдаёт TaskStatusEvent. */
export type StatusEvent = {
  toStatus: TaskStatus;
  at: Date;
};

/** Задача с её историей переходов, отсортированной по времени. */
export type FlowTask = {
  id: string;
  key: string;
  title: string;
  createdAt: Date;
  events: StatusEvent[];
};

/** Статусы, означающие «работа началась». */
const STARTED: TaskStatus[] = ["IN_PROGRESS", "REVIEW"];
/** Статусы, означающие «работа закончена». */
const FINISHED: TaskStatus[] = ["DONE", "CLOSED"];

const HOUR = 3600_000;
const DAY = 24 * HOUR;

function firstAt(events: StatusEvent[], statuses: TaskStatus[]): Date | null {
  for (const e of events) {
    if (statuses.includes(e.toStatus)) return e.at;
  }
  return null;
}

/**
 * Время цикла: от первого перехода в работу до первого попадания в готовность.
 *
 * Именно первого, а не последнего: если задачу переоткрыли и закрыли снова,
 * второй круг — это уже другая работа, и складывать её с первой значило бы
 * выдавать один долгий простой за медленную разработку.
 *
 * null — работа ещё не закончена или не начиналась.
 */
export function cycleTimeMs(task: FlowTask): number | null {
  const started = firstAt(task.events, STARTED);
  const finished = firstAt(task.events, FINISHED);
  if (!started || !finished) return null;
  const ms = finished.getTime() - started.getTime();
  // Задачу могли закрыть до того, как отметили в работе — такой «отрицательный
  // цикл» не ошибка данных, а просто порядок кликов; считать его нечем.
  return ms >= 0 ? ms : null;
}

/**
 * Время выполнения: от создания задачи до готовности. Включает ожидание в
 * очереди — то, что видит заказчик, в отличие от времени цикла.
 */
export function leadTimeMs(task: FlowTask): number | null {
  const finished = firstAt(task.events, FINISHED);
  if (!finished) return null;
  const ms = finished.getTime() - task.createdAt.getTime();
  return ms >= 0 ? ms : null;
}

/**
 * Перцентиль по уже отсортированному или произвольному ряду (линейная
 * интерполяция между соседями). p задаётся долей: 0.5 — медиана.
 */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0]!;
  const pos = (sorted.length - 1) * Math.min(Math.max(p, 0), 1);
  const low = Math.floor(pos);
  const high = Math.ceil(pos);
  if (low === high) return sorted[low]!;
  return sorted[low]! + (sorted[high]! - sorted[low]!) * (pos - low);
}

/**
 * Сколько задача пробыла в каждом статусе. Последний отрезок тянется до now,
 * если задача ещё не в конечном статусе, — иначе «В работе» у долгостроя
 * показывал бы ноль, что ровно противоположно правде.
 */
export function timeInStatus(
  task: FlowTask,
  now: Date = new Date()
): Partial<Record<TaskStatus, number>> {
  const out: Partial<Record<TaskStatus, number>> = {};
  for (let i = 0; i < task.events.length; i++) {
    const current = task.events[i]!;
    const next = task.events[i + 1];
    const until = next ? next.at.getTime() : now.getTime();
    const ms = until - current.at.getTime();
    if (ms <= 0) continue;
    out[current.toStatus] = (out[current.toStatus] ?? 0) + ms;
  }
  return out;
}

/** Понедельник недели, в которую попадает дата (локальное время). */
export function weekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export type FlowWeek = {
  /** Понедельник недели. */
  start: Date;
  label: string;
  /** Сколько задач завершено за неделю. */
  done: number;
  /** Медианное время цикла завершённых на этой неделе, в часах. null — нечего мерить. */
  medianCycleHours: number | null;
};

/**
 * Разбивка по неделям: пропускная способность и медиана времени цикла.
 *
 * Неделя привязана к моменту завершения задачи, а не создания: вопрос,
 * на который отвечает этот ряд, — «сколько мы вывозим и не растёт ли срок».
 */
export function weeklyFlow(tasks: FlowTask[], weeks: number, now: Date = new Date()): FlowWeek[] {
  const WEEK = 7 * DAY;
  const lastMonday = weekStart(now);
  const buckets: { start: Date; cycles: number[] }[] = Array.from({ length: weeks }, (_, i) => ({
    start: new Date(lastMonday.getTime() - (weeks - 1 - i) * WEEK),
    cycles: [],
  }));
  const firstStart = buckets[0]!.start.getTime();

  for (const task of tasks) {
    const finished = firstAt(task.events, FINISHED);
    if (!finished) continue;
    const index = Math.floor((finished.getTime() - firstStart) / WEEK);
    if (index < 0 || index >= weeks) continue;
    const cycle = cycleTimeMs(task);
    // Задача без отметки «в работе» всё равно считается завершённой: она
    // попадает в пропускную способность, просто не влияет на медиану.
    buckets[index]!.cycles.push(cycle ?? NaN);
  }

  return buckets.map((b) => {
    const measured = b.cycles.filter((ms) => !Number.isNaN(ms));
    const median = percentile(measured, 0.5);
    return {
      start: b.start,
      label: b.start.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }),
      done: b.cycles.length,
      medianCycleHours: median === null ? null : median / HOUR,
    };
  });
}

export type FlowSummary = {
  /** Сколько задач попало в расчёт времени цикла. */
  measured: number;
  medianCycleHours: number | null;
  /** 85-й перцентиль — обещание «почти всегда уложимся». */
  p85CycleHours: number | null;
  medianLeadHours: number | null;
  /** Среднее число завершённых задач в неделю за рассматриваемый период. */
  throughputPerWeek: number;
  /** Среднее время в каждом статусе по незавершённым задачам, в часах. */
  waitingHours: Partial<Record<TaskStatus, number>>;
};

/** Сводка по всему набору задач за заданное число недель. */
export function flowSummary(
  tasks: FlowTask[],
  weeks: number,
  now: Date = new Date()
): FlowSummary {
  const cycles: number[] = [];
  const leads: number[] = [];
  for (const task of tasks) {
    const c = cycleTimeMs(task);
    if (c !== null) cycles.push(c);
    const l = leadTimeMs(task);
    if (l !== null) leads.push(l);
  }

  const byWeek = weeklyFlow(tasks, weeks, now);
  const totalDone = byWeek.reduce((sum, w) => sum + w.done, 0);

  // «Где стоят» считаем только по незакрытым: у завершённой задачи время в
  // статусе — уже история, и оно бы разбавило картину текущих затыков.
  const waiting: Partial<Record<TaskStatus, number>> = {};
  const counts: Partial<Record<TaskStatus, number>> = {};
  for (const task of tasks) {
    if (firstAt(task.events, FINISHED)) continue;
    const spent = timeInStatus(task, now);
    for (const [status, ms] of Object.entries(spent) as [TaskStatus, number][]) {
      waiting[status] = (waiting[status] ?? 0) + ms;
      counts[status] = (counts[status] ?? 0) + 1;
    }
  }
  for (const key of Object.keys(waiting) as TaskStatus[]) {
    waiting[key] = waiting[key]! / counts[key]! / HOUR;
  }

  const medianCycle = percentile(cycles, 0.5);
  const p85 = percentile(cycles, 0.85);
  const medianLead = percentile(leads, 0.5);

  return {
    measured: cycles.length,
    medianCycleHours: medianCycle === null ? null : medianCycle / HOUR,
    p85CycleHours: p85 === null ? null : p85 / HOUR,
    medianLeadHours: medianLead === null ? null : medianLead / HOUR,
    throughputPerWeek: weeks > 0 ? totalDone / weeks : 0,
    waitingHours: waiting,
  };
}

/**
 * Человеческая длительность: часы до суток, дальше дни. «3,4 дня», «6 ч».
 * null — мерить было нечего, и это честнее нуля.
 */
export function formatDuration(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 1) return "<1 ч";
  if (hours < 24) return `${Math.round(hours)} ч`;
  const days = hours / 24;
  return `${days.toFixed(1).replace(".", ",")} дн.`;
}
