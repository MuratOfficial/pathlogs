import type { TaskStatus } from "@prisma/client";

const DAY = 86400000;
const CLOSED: TaskStatus[] = ["DONE", "CLOSED", "ARCHIVED"];

/** Задача спринта в том виде, в каком её видит расчёт burndown. */
export interface SprintTask {
  status: TaskStatus;
  estimateHours: number | null;
  /** Когда задача была закрыта; null — ещё в работе. */
  closedAt: string | null;
}

export interface BurndownPoint {
  /** День спринта в формате ISO (yyyy-mm-dd). */
  date: string;
  /** Сколько работы оставалось на конец этого дня; null — день ещё не наступил. */
  remaining: number | null;
  /** Идеальная линия: равномерное сгорание от общего объёма до нуля. */
  ideal: number;
}

/**
 * Календарный день в виде yyyy-mm-dd.
 *
 * Именно локальный, а не через toISOString: у пользователя восточнее Гринвича
 * полночь 17-го числа — это ещё 16-е по UTC, и день спринта уезжал назад.
 */
function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Начало суток — сравнения по дате не должны зависеть от времени. */
function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Объём спринта: сумма оценок, а если оценок нет ни у кого — количество задач.
 *
 * Смешивать нельзя: задача без оценки в «часовом» спринте весит ноль и создаёт
 * иллюзию, что работы меньше, чем есть. Поэтому либо все часы, либо все штуки.
 */
export function sprintScope(tasks: SprintTask[]): { total: number; unit: "часы" | "задачи" } {
  const withEstimate = tasks.filter((t) => t.estimateHours != null && t.estimateHours > 0);
  if (withEstimate.length === tasks.length && tasks.length > 0) {
    return { total: withEstimate.reduce((s, t) => s + (t.estimateHours ?? 0), 0), unit: "часы" };
  }
  return { total: tasks.length, unit: "задачи" };
}

function weightOf(task: SprintTask, unit: "часы" | "задачи"): number {
  return unit === "часы" ? task.estimateHours ?? 0 : 1;
}

/**
 * Линия сгорания по дням спринта.
 *
 * Остаток считаем по `closedAt`: задача перестаёт «висеть» в тот день, когда
 * её закрыли. Будущие дни оставляем пустыми (null) — рисовать по ним линию
 * значило бы обещать, что работа уже сделана.
 */
export function buildBurndown(
  tasks: SprintTask[],
  startsAt: Date | string,
  endsAt: Date | string,
  now: Date = new Date()
): BurndownPoint[] {
  const start = startOfDay(new Date(startsAt));
  const end = startOfDay(new Date(endsAt));
  const today = startOfDay(now);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY) + 1);
  const { total, unit } = sprintScope(tasks);

  const points: BurndownPoint[] = [];
  for (let i = 0; i < days; i++) {
    const day = new Date(start.getTime() + i * DAY);
    const ideal = days === 1 ? 0 : total * (1 - i / (days - 1));

    let remaining: number | null = null;
    if (day.getTime() <= today.getTime()) {
      remaining = tasks.reduce((sum, t) => {
        const closed =
          t.closedAt != null && startOfDay(new Date(t.closedAt)).getTime() <= day.getTime();
        return closed ? sum : sum + weightOf(t, unit);
      }, 0);
    }

    points.push({ date: ymd(day), remaining, ideal });
  }
  return points;
}

export interface SprintProgress {
  total: number;
  done: number;
  unit: "часы" | "задачи";
  /** Доля выполненного, 0…1. */
  ratio: number;
  daysLeft: number;
  /** Спринт закончился, а работа осталась. */
  overdue: boolean;
}

export function sprintProgress(
  tasks: SprintTask[],
  endsAt: Date | string,
  now: Date = new Date()
): SprintProgress {
  const { total, unit } = sprintScope(tasks);
  const done = tasks
    .filter((t) => CLOSED.includes(t.status))
    .reduce((s, t) => s + weightOf(t, unit), 0);
  const end = startOfDay(new Date(endsAt));
  const today = startOfDay(now);
  const daysLeft = Math.round((end.getTime() - today.getTime()) / DAY);
  return {
    total,
    done,
    unit,
    ratio: total > 0 ? done / total : 0,
    daysLeft,
    overdue: daysLeft < 0 && done < total,
  };
}
