"use client";

import { useActionState, useState } from "react";
import { Dialog, useDialogInline } from "./Dialog";
import { createTemplateAction, deleteTemplateAction } from "@/lib/actions/templates";
import { PRIORITY_LABELS, TYPE_LABELS } from "@/lib/labels";
import type { TaskTemplateDTO } from "@/lib/types";
import type { Priority, TaskType } from "@prisma/client";
import { Icon } from "@/components/ui/Icon";

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
  const inline = useDialogInline();
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
      {!inline && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-tip="Шаблоны задач"
          aria-label="Шаблоны задач"
          className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-2 text-xs font-medium text-muted transition hover:bg-surface-2 hover:text-foreground"
        >
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <span className="hidden sm:inline">Шаблоны</span>
          {templates.length > 0 && (
            <span className="text-accent-hover">{templates.length}</span>
          )}
        </button>
      )}

      {/* Через портал в <body>: у меню «Ещё» анимация на transform, а такой
          предок становится containing block для position: fixed — окно
          сжималось до ширины выпадающей панели */}
      <Dialog open={open} onClose={() => setOpen(false)} title="Шаблоны задач">
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
                  className="shrink-0 rounded p-1 text-muted transition hover:text-danger-text"
                >
                  <Icon name="close" className="h-4 w-4" />
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
              {state?.error && <p className="text-sm text-danger-text">{state.error}</p>}
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
              {/* Скрытые поля — в конце формы: Dialog ставит фокус на первый input, и скрытый, стоя первым, забрал бы его у видимых полей */}
              <input type="hidden" name="projectId" value={projectId} />
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
      </Dialog>
    </>
  );
}
