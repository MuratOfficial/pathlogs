import type { QueryField } from "@toimetdev/pathlogs-core";
import type { Priority, TaskStatus, TaskType } from "@prisma/client";
import { PRIORITY_LABELS, STATUS_LABELS, TYPE_LABELS } from "@/lib/labels";

/** Задача в том виде, в каком её отдаёт сервер списку «Мои задачи». */
export type MyTask = {
  id: string;
  number: number;
  title: string;
  status: TaskStatus;
  type: TaskType;
  priority: Priority;
  /** ISO — даты через границу сервер/клиент приезжают строками. */
  dueDate: string | null;
  estimateHours: number | null;
  spentHours: number;
  checklistDone: number;
  checklistTotal: number;
  projectId: string;
  projectKey: string;
  projectName: string;
};

/** Статусы, которые вообще попадают в «Мои задачи», в порядке показа. */
export const MY_TASK_STATUSES: TaskStatus[] = ["IN_PROGRESS", "REVIEW", "TODO"];

/**
 * Поля структурного поиска: `project:PAY priority:CRITICAL due:<now+7d`.
 *
 * Ключи латинские не от хорошей жизни: токенайзер во фреймворке принимает
 * ключ по /^[A-Za-z_][A-Za-z0-9_.-]*$/, и «приоритет:CRITICAL» он разбирает
 * не как условие, а как свободное слово — фильтр молча не находит ничего.
 * Русские подписи остаются в подсказках, так что набирать вслепую не придётся.
 *
 * Отдельный модуль, а не константа в компоненте: так набор полей проверяется
 * тестом вместе с matchesQuery, без поднятия браузера.
 */
export function myTaskFields(tasks: MyTask[]): QueryField<MyTask>[] {
  // Проекты берём из самих задач: предлагать проект, где на человека ничего
  // не назначено, — значит подсказывать заведомо пустой результат.
  const projects = new Map<string, string>();
  for (const t of tasks) projects.set(t.projectKey, t.projectName);

  return [
    {
      key: "project",
      label: "Проект",
      type: "enum",
      options: [...projects].map(([value, hint]) => ({ value, hint })),
      get: (t) => t.projectKey,
    },
    {
      key: "status",
      label: "Статус",
      type: "enum",
      options: MY_TASK_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
      get: (t) => t.status,
    },
    {
      key: "type",
      label: "Тип",
      type: "enum",
      options: (Object.keys(TYPE_LABELS) as TaskType[]).map((v) => ({
        value: v,
        label: TYPE_LABELS[v],
      })),
      get: (t) => t.type,
    },
    {
      key: "priority",
      label: "Приоритет",
      type: "enum",
      options: (Object.keys(PRIORITY_LABELS) as Priority[]).map((v) => ({
        value: v,
        label: PRIORITY_LABELS[v],
      })),
      get: (t) => t.priority,
    },
    {
      key: "due",
      label: "Срок",
      type: "date",
      get: (t) => (t.dueDate ? new Date(t.dueDate) : null),
    },
    {
      key: "estimate",
      label: "Оценка, ч",
      type: "number",
      get: (t) => t.estimateHours,
    },
    { key: "number", label: "Номер", type: "number", get: (t) => t.number },
  ];
}

/** Откуда искать свободные слова: название и ключ вида PAY-12. */
export function myTaskText(task: MyTask): string {
  return `${task.title} ${task.projectKey}-${task.number}`;
}
