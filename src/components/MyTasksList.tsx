"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { QueryInput, matchesQuery, parseQuery } from "@toimetdev/pathlogs-core";
import { STATUS_COLORS, STATUS_LABELS, formatDate, formatHours } from "@/lib/labels";
import { MY_TASK_STATUSES, myTaskFields, myTaskText, type MyTask } from "@/lib/myTaskQuery";
import { PriorityBadge, TypeBadge } from "@/components/TaskBadges";

export type { MyTask };

/**
 * Список моих задач по всем проектам со структурным поиском.
 *
 * Запрос разбирает queryParser из фреймворка: `project:PAY priority:CRITICAL`
 * или `due:<now+7d`. Фильтруем на клиенте — задач у одного человека десятки,
 * и ходить за этим на сервер на каждую букву незачем.
 */
export function MyTasksList({ tasks }: { tasks: MyTask[] }) {
  const [query, setQuery] = useState("");
  const fields = useMemo(() => myTaskFields(tasks), [tasks]);

  const parsed = useMemo(() => parseQuery(query, fields), [query, fields]);

  const visible = useMemo(
    () =>
      tasks.filter((t) =>
        matchesQuery(t, parsed, fields, { text: myTaskText })
      ),
    [tasks, parsed, fields]
  );

  const now = new Date();
  const overdue = visible.filter((t) => t.dueDate && new Date(t.dueDate) < now).length;
  const filtering = query.trim().length > 0;

  return (
    <div className="mx-auto max-w-full">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight">Мои задачи</h1>
        <div className="flex items-center gap-4 text-xs text-muted">
          <span>
            {filtering ? "Найдено" : "Открыто"}:{" "}
            <b className="text-foreground">{visible.length}</b>
            {filtering && ` из ${tasks.length}`}
          </span>
          {overdue > 0 && (
            <span className="rounded-md bg-danger/15 px-2 py-1 font-semibold text-danger">
              Просрочено: {overdue}
            </span>
          )}
        </div>
      </div>

      <div className="mb-5">
        <QueryInput
          value={query}
          onChange={setQuery}
          fields={fields}
          placeholder="project:PAY priority:CRITICAL due:<now+7d — или просто слово"
        />
        {parsed.unknownKeys.length > 0 && (
          // Неизвестный ключ не совпадает ни с чем, и без подписи список
          // выглядел бы просто пустым — как будто задач нет.
          <p className="mt-1.5 text-xs text-warning">
            Нет такого поля: {parsed.unknownKeys.join(", ")}. Доступны:{" "}
            {fields.map((f) => f.key).join(", ")}.
          </p>
        )}
      </div>

      {tasks.length === 0 && (
        <p className="rounded-2xl border border-edge bg-surface p-6 text-sm text-muted">
          На вас не назначено открытых задач. Отличный момент взять что-то с доски.
        </p>
      )}

      {tasks.length > 0 && visible.length === 0 && (
        <p className="rounded-2xl border border-edge bg-surface p-6 text-sm text-muted">
          Под запрос ничего не подошло.
        </p>
      )}

      {MY_TASK_STATUSES.map((status) => {
        const group = visible.filter((t) => t.status === status);
        if (group.length === 0) return null;
        return (
          <section key={status} className="mb-6">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: STATUS_COLORS[status] }}
              />
              {STATUS_LABELS[status]} ({group.length})
            </h2>
            <ul className="space-y-2">
              {group.map((t) => {
                const isOverdue = t.dueDate && new Date(t.dueDate) < now;
                return (
                  <li key={t.id}>
                    <Link
                      href={`/tasks/${t.id}`}
                      className="flex items-center gap-3 rounded-xl border border-edge bg-surface px-4 py-[var(--app-row-py)] transition hover:border-accent/50"
                    >
                      <span className="font-mono text-xs text-muted">
                        {t.projectKey}-{t.number}
                      </span>
                      <TypeBadge type={t.type} />
                      <PriorityBadge priority={t.priority} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {t.title}
                      </span>
                      {t.checklistTotal > 0 && (
                        <span className="shrink-0 text-xs text-muted">
                          ☑ {t.checklistDone}/{t.checklistTotal}
                        </span>
                      )}
                      {(t.spentHours > 0 || t.estimateHours) && (
                        <span className="shrink-0 text-xs text-muted">
                          {formatHours(t.spentHours)}
                          {t.estimateHours ? ` / ${formatHours(t.estimateHours)}` : ""}
                        </span>
                      )}
                      {t.dueDate && (
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${
                            isOverdue
                              ? "bg-danger/15 font-semibold text-danger"
                              : "text-muted"
                          }`}
                        >
                          {formatDate(new Date(t.dueDate))}
                        </span>
                      )}
                      <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">
                        {t.projectName}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
