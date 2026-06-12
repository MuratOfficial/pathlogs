"use client";

import { useActionState, useState } from "react";
import { createTaskAction } from "@/lib/actions/tasks";
import { PRIORITY_LABELS, TYPE_LABELS } from "@/lib/labels";
import type { TaskDTO, MemberDTO } from "@/lib/types";
import type { Priority, TaskType } from "@prisma/client";

export function NewTaskDialog({
  projectId,
  tasks,
  members,
  defaultParentId,
  triggerLabel = "+ Новая задача",
  triggerClassName = "rounded-lg bg-accent px-4 py-2 text-sm font-semibold transition hover:bg-accent-hover",
}: {
  projectId: string;
  tasks: Pick<TaskDTO, "id" | "number" | "title">[];
  members: MemberDTO[];
  defaultParentId?: string;
  triggerLabel?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prev: { error?: string } | undefined, formData: FormData) => {
      const res = await createTaskAction(prev, formData);
      if (!res.error) setOpen(false);
      return res;
    },
    undefined
  );

  const inputCls =
    "w-full rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent";

  return (
    <>
      <button onClick={() => setOpen(true)} className={triggerClassName}>
        {triggerLabel}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <form
            action={formAction}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-edge bg-surface p-6 shadow-2xl"
          >
            <h2 className="mb-5 text-lg font-semibold">Новая задача</h2>
            <input type="hidden" name="projectId" value={projectId} />

            <label className="mb-4 block">
              <span className="mb-1.5 block text-sm text-muted">Название *</span>
              <input name="title" required minLength={2} placeholder="Что нужно сделать" className={inputCls} />
            </label>

            <label className="mb-4 block">
              <span className="mb-1.5 block text-sm text-muted">
                Описание <span className="text-xs">· поддерживается markdown</span>
              </span>
              <textarea name="description" rows={3} placeholder="Детали, контекст, критерии приёмки…" className={`${inputCls} resize-none`} />
            </label>

            <label className="mb-4 block">
              <span className="mb-1.5 block text-sm text-muted">
                Чек-лист <span className="text-xs">· по пункту на строку</span>
              </span>
              <textarea
                name="checklist"
                rows={3}
                placeholder={"Написать тесты\nОбновить документацию\nПроверить на staging"}
                className={`${inputCls} resize-none`}
              />
            </label>

            <div className="mb-4 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-sm text-muted">Тип</span>
                <select name="type" defaultValue="FEATURE" className={inputCls}>
                  {(Object.keys(TYPE_LABELS) as TaskType[]).map((t) => (
                    <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm text-muted">Приоритет</span>
                <select name="priority" defaultValue="MEDIUM" className={inputCls}>
                  {(Object.keys(PRIORITY_LABELS) as Priority[]).map((p) => (
                    <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="mb-4 block">
              <span className="mb-1.5 block text-sm text-muted">
                Родительская задача (ветка)
              </span>
              <select name="parentId" defaultValue={defaultParentId ?? ""} className={inputCls}>
                <option value="">— Корень проекта —</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    #{t.number} · {t.title}
                  </option>
                ))}
              </select>
            </label>

            <div className="mb-4 grid grid-cols-3 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-sm text-muted">Оценка, ч</span>
                <input name="estimateHours" type="number" step="0.5" min="0.5" placeholder="8" className={inputCls} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm text-muted">Начало</span>
                <input name="startDate" type="date" className={inputCls} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm text-muted">Срок</span>
                <input name="dueDate" type="date" className={inputCls} />
              </label>
            </div>

            <fieldset className="mb-5">
              <span className="mb-1.5 block text-sm text-muted">Исполнители</span>
              <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-edge bg-surface-2 p-2">
                {members.map((m) => (
                  <label key={m.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-surface">
                    <input type="checkbox" name="assigneeIds" value={m.id} className="accent-indigo-500" />
                    {m.name}
                  </label>
                ))}
                {members.length === 0 && (
                  <p className="px-2 py-1 text-xs text-muted">Нет пользователей</p>
                )}
              </div>
            </fieldset>

            {state?.error && (
              <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {state.error}
              </p>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-edge px-4 py-2 text-sm text-muted transition hover:bg-surface-2"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold transition hover:bg-accent-hover disabled:opacity-50"
              >
                {pending ? "Создаём…" : "Создать задачу"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
