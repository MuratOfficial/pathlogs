import type { Priority, Role, TaskStatus, TaskType } from "@prisma/client";

export const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "К выполнению",
  IN_PROGRESS: "В работе",
  REVIEW: "На проверке",
  DONE: "Готово",
  CLOSED: "Закрыта",
  ARCHIVED: "В архиве",
};

export const STATUS_COLORS: Record<TaskStatus, string> = {
  TODO: "#94a3b8",
  IN_PROGRESS: "#60a5fa",
  REVIEW: "#c084fc",
  DONE: "#4ade80",
  CLOSED: "#34d399",
  ARCHIVED: "#64748b",
};

export const TYPE_LABELS: Record<TaskType, string> = {
  FEATURE: "Фича",
  BUG: "Баг",
  REFACTOR: "Рефакторинг",
  ANALYTICS: "Аналитика",
  MANAGEMENT: "Менеджмент",
  DESIGN: "Дизайн",
  DOCS: "Документация",
  RESEARCH: "Исследование",
};

export const TYPE_COLORS: Record<TaskType, string> = {
  FEATURE: "#6366f1",
  BUG: "#ef4444",
  REFACTOR: "#f59e0b",
  ANALYTICS: "#06b6d4",
  MANAGEMENT: "#ec4899",
  DESIGN: "#a855f7",
  DOCS: "#84cc16",
  RESEARCH: "#14b8a6",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: "Низкий",
  MEDIUM: "Средний",
  HIGH: "Высокий",
  CRITICAL: "Критический",
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  LOW: "#94a3b8",
  MEDIUM: "#60a5fa",
  HIGH: "#f97316",
  CRITICAL: "#ef4444",
};

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Администратор",
  MANAGER: "Менеджер",
  ANALYST: "Аналитик",
  DEVELOPER: "Разработчик",
};

export const KANBAN_COLUMNS: TaskStatus[] = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"];

/** Палитра для перекраски карточек и колонок. */
export const BOARD_PALETTE = [
  "#94a3b8",
  "#60a5fa",
  "#6366f1",
  "#c084fc",
  "#ec4899",
  "#ef4444",
  "#f59e0b",
  "#84cc16",
  "#4ade80",
  "#14b8a6",
] as const;

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatHours(h: number): string {
  if (h === 0) return "0 ч";
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  if (whole === 0) return `${mins} мин`;
  if (mins === 0) return `${whole} ч`;
  return `${whole} ч ${mins} мин`;
}
