"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { TaskStatus, TaskType } from "@prisma/client";
import type { TaskDTO, MemberDTO } from "@/lib/types";
import {
  STATUS_COLORS,
  STATUS_LABELS,
  TYPE_LABELS,
  formatDate,
  formatHours,
} from "@/lib/labels";
import { saveFilterAction, deleteFilterAction } from "@/lib/actions/filters";
import { AssigneeAvatars, PriorityDot, TypeBadge } from "./TaskBadges";

export interface SavedFilterDTO {
  id: string;
  name: string;
  query: string;
}

export function TaskListView({
  tasks,
  projectKey,
  members,
  projectId,
  savedFilters = [],
}: {
  tasks: TaskDTO[];
  projectKey: string;
  members: MemberDTO[];
  projectId: string;
  savedFilters?: SavedFilterDTO[];
}) {
  const [status, setStatus] = useState<TaskStatus | "ALL">("ALL");
  const [type, setType] = useState<TaskType | "ALL">("ALL");
  const [assignee, setAssignee] = useState<string>("ALL");
  const [q, setQ] = useState("");
  const [, startTransition] = useTransition();

  function applyFilter(query: string) {
    const p = new URLSearchParams(query);
    setStatus((p.get("status") as TaskStatus) || "ALL");
    setType((p.get("type") as TaskType) || "ALL");
    setAssignee(p.get("assignee") || "ALL");
    setQ(p.get("q") || "");
  }

  function saveCurrent() {
    const name = window.prompt("Название фильтра:");
    if (!name) return;
    const params = new URLSearchParams();
    if (status !== "ALL") params.set("status", status);
    if (type !== "ALL") params.set("type", type);
    if (assignee !== "ALL") params.set("assignee", assignee);
    if (q) params.set("q", q);
    startTransition(() => saveFilterAction(projectId, name, params.toString()));
  }

  const active = status !== "ALL" || type !== "ALL" || assignee !== "ALL" || q !== "";

  const filtered = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (status === "ALL" || t.status === status) &&
          (type === "ALL" || t.type === type) &&
          (assignee === "ALL" || t.assignees.some((a) => a.id === assignee)) &&
          (!q || t.title.toLowerCase().includes(q.toLowerCase()) || String(t.number).includes(q))
      ),
    [tasks, status, type, assignee, q]
  );

  const selectCls =
    "rounded-lg border border-edge bg-surface-2 px-3 py-1.5 text-sm outline-none focus:border-accent";

  return (
    <div className="flex h-full flex-col rounded-2xl border border-edge bg-surface/60">
      <div className="flex flex-wrap items-center gap-3 border-b border-edge p-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск по названию или номеру…"
          className="w-64 rounded-lg border border-edge bg-surface-2 px-3 py-1.5 text-sm outline-none focus:border-accent"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus | "ALL")} className={selectCls}>
          <option value="ALL">Все статусы</option>
          {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value as TaskType | "ALL")} className={selectCls}>
          <option value="ALL">Все типы</option>
          {(Object.keys(TYPE_LABELS) as TaskType[]).map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>
        <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={selectCls}>
          <option value="ALL">Все исполнители</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={saveCurrent}
          disabled={!active}
          title={active ? "Сохранить текущие фильтры" : "Задайте фильтры, чтобы сохранить"}
          className="rounded-lg border border-edge px-3 py-1.5 text-sm text-muted transition hover:bg-surface-2 hover:text-foreground disabled:opacity-40"
        >
          ★ Сохранить фильтр
        </button>
        <span className="ml-auto text-xs text-muted">{filtered.length} задач</span>
      </div>

      {savedFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-edge px-4 py-2">
          <span className="text-xs text-muted">Сохранённые:</span>
          {savedFilters.map((f) => (
            <span
              key={f.id}
              className="group flex items-center gap-1 rounded-full border border-edge bg-surface-2 px-2.5 py-1 text-xs"
            >
              <button
                type="button"
                onClick={() => applyFilter(f.query)}
                className="transition hover:text-accent-hover"
              >
                {f.name}
              </button>
              <button
                type="button"
                title="Удалить фильтр"
                onClick={() => startTransition(() => deleteFilterAction(f.id))}
                className="text-muted/60 transition hover:text-red-400"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">№</th>
              <th className="px-4 py-2.5 font-medium">Задача</th>
              <th className="px-4 py-2.5 font-medium">Тип</th>
              <th className="px-4 py-2.5 font-medium">Статус</th>
              <th className="px-4 py-2.5 font-medium">Исполнители</th>
              <th className="px-4 py-2.5 font-medium">Срок</th>
              <th className="px-4 py-2.5 font-medium">Время</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} className="border-t border-edge/60 transition hover:bg-surface-2/50">
                <td className="px-4 py-3 font-mono text-xs text-muted">
                  {projectKey}-{t.number}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/tasks/${t.id}`} className="flex items-center gap-2 font-medium hover:text-accent-hover">
                    <PriorityDot priority={t.priority} />
                    {t.title}
                  </Link>
                </td>
                <td className="px-4 py-3"><TypeBadge type={t.type} /></td>
                <td className="px-4 py-3">
                  <span
                    className="rounded px-2 py-0.5 text-xs font-medium"
                    style={{ backgroundColor: STATUS_COLORS[t.status] + "26", color: STATUS_COLORS[t.status] }}
                  >
                    {STATUS_LABELS[t.status]}
                  </span>
                </td>
                <td className="px-4 py-3"><AssigneeAvatars assignees={t.assignees} /></td>
                <td className="px-4 py-3 text-xs text-muted">{formatDate(t.dueDate)}</td>
                <td className="px-4 py-3 text-xs text-muted">
                  {t.spentHours > 0 ? formatHours(t.spentHours) : "—"}
                  {t.estimateHours ? ` / ${formatHours(t.estimateHours)}` : ""}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted">
                  Ничего не найдено
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
