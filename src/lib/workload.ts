import type { TaskStatus } from "@prisma/client";

/** Задача в том виде, в каком она нужна для расчёта нагрузки. */
export interface WorkloadTask {
  status: TaskStatus;
  estimateHours: number | null;
  spentHours: number;
  dueDate: string | null;
  assignees: { id: string; name: string }[];
}

/** Строка сводки по одному человеку. */
export interface WorkloadRow {
  userId: string;
  name: string;
  /** Незакрытые задачи: именно они и есть текущая нагрузка. */
  openTasks: number;
  inProgress: number;
  overdue: number;
  /** Часы по незакрытым задачам — сколько работы ещё висит. */
  openEstimate: number;
  /** Списанные часы по всем его задачам, включая закрытые. */
  spentHours: number;
}

const CLOSED: TaskStatus[] = ["DONE", "CLOSED", "ARCHIVED"];

export function isOpen(status: TaskStatus): boolean {
  return !CLOSED.includes(status);
}

/**
 * Сводка нагрузки по людям.
 *
 * Часы задачи с несколькими исполнителями делятся между ними поровну: иначе
 * общая сумма по команде оказалась бы больше реальной, и «перегруженными»
 * выглядели бы все участники крупной задачи сразу.
 */
export function buildWorkload(
  tasks: WorkloadTask[],
  members: { id: string; name: string }[],
  now: Date = new Date()
): WorkloadRow[] {
  const rows = new Map<string, WorkloadRow>();
  for (const m of members) {
    rows.set(m.id, {
      userId: m.id,
      name: m.name,
      openTasks: 0,
      inProgress: 0,
      overdue: 0,
      openEstimate: 0,
      spentHours: 0,
    });
  }

  for (const t of tasks) {
    if (t.assignees.length === 0) continue;
    const share = 1 / t.assignees.length;
    const open = isOpen(t.status);
    const overdue = open && t.dueDate != null && new Date(t.dueDate) < now;

    for (const a of t.assignees) {
      const row = rows.get(a.id) ?? {
        userId: a.id,
        name: a.name,
        openTasks: 0,
        inProgress: 0,
        overdue: 0,
        openEstimate: 0,
        spentHours: 0,
      };
      if (open) {
        row.openTasks += 1;
        if (t.status === "IN_PROGRESS") row.inProgress += 1;
        if (overdue) row.overdue += 1;
        row.openEstimate += (t.estimateHours ?? 0) * share;
      }
      row.spentHours += t.spentHours * share;
      rows.set(a.id, row);
    }
  }

  const result = [...rows.values()];

  // Сверху — самые загруженные: сначала по открытым задачам, при равенстве
  // по часам; так строка, требующая внимания, не теряется в середине списка
  return result.sort(
    (a, b) => b.openTasks - a.openTasks || b.openEstimate - a.openEstimate
  );
}

/** Сколько задач проекта вообще никому не назначено — их не видно в сводке. */
export function unassignedCount(tasks: WorkloadTask[]): number {
  return tasks.filter((t) => isOpen(t.status) && t.assignees.length === 0).length;
}
