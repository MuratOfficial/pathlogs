"use client";

import { useActionState, useState } from "react";
import { createTemplateAction, deleteTemplateAction } from "@/lib/actions/templates";
import { PRIORITY_LABELS, TYPE_LABELS } from "@/lib/labels";
import type { TaskTemplateDTO } from "@/lib/types";
import type { Priority, TaskType } from "@prisma/client";

export function TemplatesDialog({
  projectId,
  templates,
  canManage,
}: {
  projectId: string;
  templates: TaskTemplateDTO[];
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prev: { error?: string } | undefined, formData: FormData) => {
      const res = await createTemplateAction(prev, formData);
      if (!res.error) setAdding(false);
      return res;
    },
    undefined
  );

  const inputCls =
    "w-full rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-tip="Шаблоны задач"
        className="rounded-lg border border-edge px-3 py-2 text-xs font-medium text-muted transition hover:bg-surface-2 hover:text-foreground"
      >
        Шаблоны
        {templates.length > 0 && (
          <span className="ml-1.5 text-accent-hover">{templates.length}</span>
        )}
      </button>

      {open && (
        <div
          className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="animate-pop-in max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-edge bg-surface p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Шаблоны задач</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-muted transition hover:text-foreground"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <ul className="mb-4 space-y-2">
              {templates.map((t) => (
                <li
                  key={t.id}
                  className="flex items-start gap-3 rounded-xl border border-edge bg-surface-2/50 px-4 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted">
                      {TYPE_LABELS[t.type]} · {PRIORITY_LABELS[t.priority]}
                      {t.checklist
                        ? ` · ${t.checklist.split(/\r?\n/).filter(Boolean).length} пункт(ов)`
                        : ""}
                    </p>
                  </div>
                  {canManage && (
                    <button
                      type="button"
                      data-tip="Удалить шаблон"
                      onClick={() => deleteTemplateAction(t.id)}
                      className="shrink-0 rounded p-1 text-muted transition hover:text-red-400"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </li>
              ))}
              {templates.length === 0 && (
                <p className="text-sm text-muted">
                  Шаблонов нет. Создайте типовую задачу (например «Релиз») с готовым
                  чек-листом — она появится в форме создания.
                </p>
              )}
            </ul>

            {canManage &&
              (adding ? (
                <form action={formAction} className="space-y-3 rounded-xl border border-edge bg-surface-2/40 p-4">
                  <input type="hidden" name="projectId" value={projectId} />
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted">Название шаблона *</span>
                    <input name="name" required minLength={2} placeholder="Релиз" className={inputCls} />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1 block text-xs text-muted">Тип</span>
                      <select name="type" defaultValue="MANAGEMENT" className={inputCls}>
                        {(Object.keys(TYPE_LABELS) as TaskType[]).map((t) => (
                          <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs text-muted">Приоритет</span>
                      <select name="priority" defaultValue="MEDIUM" className={inputCls}>
                        {(Object.keys(PRIORITY_LABELS) as Priority[]).map((p) => (
                          <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted">Префикс названия</span>
                    <input name="titlePrefix" placeholder="Релиз v" className={inputCls} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted">Описание (markdown)</span>
                    <textarea name="description" rows={2} className={`${inputCls} resize-none`} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted">Чек-лист · по пункту на строку</span>
                    <textarea
                      name="checklist"
                      rows={4}
                      placeholder={"Заморозить ветку\nПрогнать регресс\nОбновить changelog\nВыкатить на prod"}
                      className={`${inputCls} resize-none`}
                    />
                  </label>
                  {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setAdding(false)}
                      className="rounded-lg border border-edge px-3 py-1.5 text-sm text-muted transition hover:text-foreground"
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      disabled={pending}
                      className="rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold transition hover:bg-accent-hover disabled:opacity-50"
                    >
                      {pending ? "Сохраняем…" : "Создать шаблон"}
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="w-full rounded-lg border border-dashed border-edge py-2 text-sm text-muted transition hover:border-accent/60 hover:text-foreground"
                >
                  + Новый шаблон
                </button>
              ))}
          </div>
        </div>
      )}
    </>
  );
}
