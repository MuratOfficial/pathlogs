import type { TaskStatus, TaskType, Priority } from "@prisma/client";

/**
 * Фильтр задач, общий для списка и доски. Хранится строкой запроса
 * (`status=TODO&assignee=…`) — в этом же виде он лежит в сохранённых фильтрах,
 * поэтому один и тот же фильтр применяется в обоих представлениях.
 *
 * "ALL" вместо пустого значения: так селекты в интерфейсе всегда имеют
 * выбранный вариант, а не «пустой» первый пункт.
 */
export interface TaskFilter {
  q: string;
  status: TaskStatus | "ALL";
  type: TaskType | "ALL";
  priority: Priority | "ALL";
  assignee: string | "ALL";
  tag: string | "ALL";
}

export const EMPTY_FILTER: TaskFilter = {
  q: "",
  status: "ALL",
  type: "ALL",
  priority: "ALL",
  assignee: "ALL",
  tag: "ALL",
};

/** Минимум, по которому задачу можно отфильтровать. */
export interface FilterableTask {
  number: number;
  title: string;
  status: TaskStatus;
  type: TaskType;
  priority: Priority;
  assignees: { id: string }[];
  tags: { id: string }[];
}

/** Разбирает строку сохранённого фильтра. Неизвестные ключи игнорируются. */
export function parseTaskFilter(query: string): TaskFilter {
  const p = new URLSearchParams(query);
  const val = <T extends string>(key: string): T | "ALL" =>
    (p.get(key) as T) || "ALL";
  return {
    q: p.get("q") ?? "",
    status: val<TaskStatus>("status"),
    type: val<TaskType>("type"),
    priority: val<Priority>("priority"),
    assignee: val<string>("assignee"),
    tag: val<string>("tag"),
  };
}

/** Собирает строку запроса: в неё попадают только заданные условия. */
export function serializeTaskFilter(filter: TaskFilter): string {
  const p = new URLSearchParams();
  if (filter.q) p.set("q", filter.q);
  if (filter.status !== "ALL") p.set("status", filter.status);
  if (filter.type !== "ALL") p.set("type", filter.type);
  if (filter.priority !== "ALL") p.set("priority", filter.priority);
  if (filter.assignee !== "ALL") p.set("assignee", filter.assignee);
  if (filter.tag !== "ALL") p.set("tag", filter.tag);
  return p.toString();
}

/** Задан ли хоть один критерий — от этого зависит, есть ли что сохранять и сбрасывать. */
export function isFilterActive(filter: TaskFilter): boolean {
  return serializeTaskFilter(filter) !== "";
}

/**
 * Подходит ли задача под фильтр. Текст ищем и в названии, и в номере: «12»
 * находит PAY-12, а «оплат» — «Страница оплаты».
 */
export function matchesTaskFilter(task: FilterableTask, filter: TaskFilter): boolean {
  if (filter.status !== "ALL" && task.status !== filter.status) return false;
  if (filter.type !== "ALL" && task.type !== filter.type) return false;
  if (filter.priority !== "ALL" && task.priority !== filter.priority) return false;
  if (filter.assignee !== "ALL" && !task.assignees.some((a) => a.id === filter.assignee)) {
    return false;
  }
  if (filter.tag !== "ALL" && !task.tags.some((t) => t.id === filter.tag)) return false;

  const q = filter.q.trim().toLowerCase();
  if (!q) return true;
  return task.title.toLowerCase().includes(q) || String(task.number).includes(q);
}
