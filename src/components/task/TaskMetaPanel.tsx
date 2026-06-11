"use client";

import { useTransition } from "react";
import type { Priority, TaskStatus, TaskType } from "@prisma/client";
import { updateTaskFieldsAction, updateTaskStatusAction } from "@/lib/actions/tasks";
import { PRIORITY_LABELS, STATUS_LABELS, TYPE_LABELS } from "@/lib/labels";
import type { MemberDTO } from "@/lib/types";

interface Meta {
  id: string;
  status: TaskStatus;
  type: TaskType;
  priority: Priority;
  estimateHours: number | null;
  startDate: string | null;
  dueDate: string | null;
  assigneeIds: string[];
}

export function TaskMetaPanel({ task, users }: { task: Meta; users: MemberDTO[] }) {
  const [pending, startTransition] = useTransition();

  const selectCls =
    "w-full rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent";

  function update(fields: Parameters<typeof updateTaskFieldsAction>[1]) {
    startTransition(() => updateTaskFieldsAction(task.id, fields));
  }

  return (
    <section
      className={`rounded-2xl border border-edge bg-surface p-5 ${pending ? "opacity-70" : ""}`}
    >
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted">
        Параметры
      </h2>

      <label className="mb-3 block">
        <span className="mb-1 block text-xs text-muted">Статус</span>
        <select
          value={task.status}
          onChange={(e) =>
            startTransition(() =>
              updateTaskStatusAction(task.id, e.target.value as TaskStatus)
            )
          }
          className={selectCls}
        >
          {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
      </label>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs text-muted">Тип</span>
          <select
            value={task.type}
            onChange={(e) => update({ type: e.target.value as TaskType })}
            className={selectCls}
          >
            {(Object.keys(TYPE_LABELS) as TaskType[]).map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted">Приоритет</span>
          <select
            value={task.priority}
            onChange={(e) => update({ priority: e.target.value as Priority })}
            className={selectCls}
          >
            {(Object.keys(PRIORITY_LABELS) as Priority[]).map((p) => (
              <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="mb-3 block">
        <span className="mb-1 block text-xs text-muted">Оценка, часов</span>
        <input
          type="number"
          step="0.5"
          min="0"
          defaultValue={task.estimateHours ?? ""}
          onBlur={(e) =>
            update({ estimateHours: e.target.value ? Number(e.target.value) : null })
          }
          className={selectCls}
        />
      </label>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs text-muted">Начало</span>
          <input
            type="date"
            defaultValue={task.startDate ?? ""}
            onChange={(e) => update({ startDate: e.target.value || null })}
            className={selectCls}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted">Срок</span>
          <input
            type="date"
            defaultValue={task.dueDate ?? ""}
            onChange={(e) => update({ dueDate: e.target.value || null })}
            className={selectCls}
          />
        </label>
      </div>

      <fieldset>
        <span className="mb-1 block text-xs text-muted">Исполнители</span>
        <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-lg border border-edge bg-surface-2 p-1.5">
          {users.map((u) => (
            <label
              key={u.id}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-surface"
            >
              <input
                type="checkbox"
                className="accent-indigo-500"
                checked={task.assigneeIds.includes(u.id)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...task.assigneeIds, u.id]
                    : task.assigneeIds.filter((id) => id !== u.id);
                  update({ assigneeIds: next });
                }}
              />
              {u.name}
            </label>
          ))}
        </div>
      </fieldset>
    </section>
  );
}
