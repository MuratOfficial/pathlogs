"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TaskStatus } from "@prisma/client";
import type { TaskDTO } from "@/lib/types";
import { updateTaskStatusAction } from "@/lib/actions/tasks";
import { KANBAN_COLUMNS, STATUS_COLORS, STATUS_LABELS, formatDate, formatHours } from "@/lib/labels";
import { AssigneeAvatars, PriorityDot, TypeBadge } from "./TaskBadges";

export function KanbanBoard({
  tasks: initialTasks,
  projectKey,
}: {
  tasks: TaskDTO[];
  projectKey: string;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<TaskStatus | null>(null);
  const [, startTransition] = useTransition();

  function onDrop(status: TaskStatus) {
    if (!dragId) return;
    const id = dragId;
    setDragId(null);
    setOverCol(null);
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    startTransition(() => updateTaskStatusAction(id, status));
  }

  return (
    <div className="flex h-full gap-4 overflow-x-auto pb-4">
      {KANBAN_COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col);
        return (
          <div
            key={col}
            onDragOver={(e) => {
              e.preventDefault();
              setOverCol(col);
            }}
            onDragLeave={() => setOverCol((c) => (c === col ? null : c))}
            onDrop={() => onDrop(col)}
            className={`flex w-80 shrink-0 flex-col rounded-2xl border bg-surface/60 transition ${
              overCol === col ? "border-accent/60 bg-accent/5" : "border-edge"
            }`}
          >
            <div className="flex items-center gap-2 px-4 py-3">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: STATUS_COLORS[col] }}
              />
              <h3 className="text-sm font-semibold">{STATUS_LABELS[col]}</h3>
              <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">
                {colTasks.length}
              </span>
            </div>

            <div className="flex-1 space-y-2.5 overflow-y-auto px-3 pb-3">
              {colTasks.map((t) => (
                <div
                  key={t.id}
                  draggable
                  onDragStart={() => setDragId(t.id)}
                  onDragEnd={() => setDragId(null)}
                  onClick={() => router.push(`/tasks/${t.id}`)}
                  className={`cursor-pointer rounded-xl border border-edge bg-surface p-3.5 transition hover:border-accent/50 ${
                    dragId === t.id ? "opacity-40" : ""
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="font-mono text-[11px] font-semibold text-muted">
                      {projectKey}-{t.number}
                    </span>
                    <TypeBadge type={t.type} />
                    <span className="ml-auto">
                      <PriorityDot priority={t.priority} />
                    </span>
                  </div>
                  <p className="mb-2.5 text-sm font-medium leading-snug">{t.title}</p>
                  <div className="flex items-center gap-2 text-[11px] text-muted">
                    <AssigneeAvatars assignees={t.assignees} />
                    {t.childrenCount > 0 && (
                      <span title="Подзадачи" className="flex items-center gap-0.5">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                        </svg>
                        {t.childrenCount}
                      </span>
                    )}
                    {t.patchLogCount > 0 && (
                      <span title="Патч-логи" className="flex items-center gap-0.5">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        {t.patchLogCount}
                      </span>
                    )}
                    {t.spentHours > 0 && (
                      <span title="Затрачено времени" className="flex items-center gap-0.5">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {formatHours(t.spentHours)}
                      </span>
                    )}
                    {t.dueDate && <span className="ml-auto">{formatDate(t.dueDate)}</span>}
                  </div>
                </div>
              ))}
              {colTasks.length === 0 && (
                <div className="rounded-xl border border-dashed border-edge/60 py-8 text-center text-xs text-muted/60">
                  Перетащите задачу сюда
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
