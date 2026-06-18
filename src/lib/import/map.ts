import type { Priority, TaskStatus, TaskType } from "@prisma/client";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  TYPE_LABELS,
} from "@/lib/labels";

/** Нормализованная задача, полученная из импортируемого файла. */
export interface ParsedTask {
  /** Стабильный идентификатор внутри импорта (для связки родитель→потомок). */
  ref: string;
  /** ref родительской задачи либо null. */
  parentRef: string | null;
  title: string;
  description: string | null;
  status: TaskStatus | null;
  type: TaskType | null;
  priority: Priority | null;
  /** Имя колонки/списка (Excel/Trello-подобный импорт). null — группировать по статусу. */
  columnName: string | null;
  /** E-mail исполнителей — сопоставляются с существующими пользователями при импорте. */
  assigneeEmails: string[];
  estimateHours: number | null;
  startDate: Date | null;
  dueDate: Date | null;
  order: number;
}

export interface ParsedImport {
  format: "excel" | "msproject";
  /** Предлагаемое имя проекта (из метаданных файла), либо null. */
  projectName: string | null;
  tasks: ParsedTask[];
}

/** Приводит строку к ключу для регистронезависимого сравнения. */
function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildMap<T extends string>(
  labels: Record<T, string>,
  extra: Record<string, T>
): Map<string, T> {
  const m = new Map<string, T>();
  for (const key of Object.keys(labels) as T[]) {
    m.set(norm(labels[key]), key); // русский лейбл
    m.set(norm(key), key); // имя enum (EN)
  }
  for (const [alias, value] of Object.entries(extra)) {
    m.set(norm(alias), value as T);
  }
  return m;
}

const STATUS_MAP = buildMap<TaskStatus>(STATUS_LABELS, {
  "to do": "TODO",
  todo: "TODO",
  backlog: "TODO",
  open: "TODO",
  new: "TODO",
  новая: "TODO",
  новый: "TODO",
  "not started": "TODO",
  "in progress": "IN_PROGRESS",
  doing: "IN_PROGRESS",
  выполняется: "IN_PROGRESS",
  started: "IN_PROGRESS",
  "in development": "IN_PROGRESS",
  "на ревью": "REVIEW",
  testing: "REVIEW",
  тестирование: "REVIEW",
  qa: "REVIEW",
  complete: "DONE",
  completed: "DONE",
  завершено: "DONE",
  выполнено: "DONE",
  finished: "DONE",
  закрыто: "CLOSED",
  архив: "ARCHIVED",
});

const TYPE_MAP = buildMap<TaskType>(TYPE_LABELS, {
  feature: "FEATURE",
  story: "FEATURE",
  task: "FEATURE",
  задача: "FEATURE",
  улучшение: "FEATURE",
  bug: "BUG",
  ошибка: "BUG",
  дефект: "BUG",
  defect: "BUG",
  refactor: "REFACTOR",
  refactoring: "REFACTOR",
  analytics: "ANALYTICS",
  management: "MANAGEMENT",
  design: "DESIGN",
  docs: "DOCS",
  documentation: "DOCS",
  research: "RESEARCH",
  исследование: "RESEARCH",
});

const PRIORITY_MAP = buildMap<Priority>(PRIORITY_LABELS, {
  low: "LOW",
  lowest: "LOW",
  minor: "LOW",
  trivial: "LOW",
  medium: "MEDIUM",
  normal: "MEDIUM",
  обычный: "MEDIUM",
  high: "HIGH",
  major: "HIGH",
  critical: "CRITICAL",
  blocker: "CRITICAL",
  highest: "CRITICAL",
  срочный: "CRITICAL",
});

export function mapStatus(raw: string | null | undefined): TaskStatus | null {
  if (!raw) return null;
  return STATUS_MAP.get(norm(raw)) ?? null;
}

export function mapType(raw: string | null | undefined): TaskType | null {
  if (!raw) return null;
  return TYPE_MAP.get(norm(raw)) ?? null;
}

export function mapPriority(raw: string | null | undefined): Priority | null {
  if (!raw) return null;
  return PRIORITY_MAP.get(norm(raw)) ?? null;
}

/** MS Project хранит приоритет числом 0–1000 (500 — норма). */
export function priorityFromNumber(n: number): Priority {
  if (n >= 900) return "CRITICAL";
  if (n >= 700) return "HIGH";
  if (n <= 200) return "LOW";
  return "MEDIUM";
}

/** Разбивает строку исполнителей на отдельные e-mail/имена. */
export function splitAssignees(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
