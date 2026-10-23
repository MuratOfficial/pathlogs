"use client";

import { useActionState, useState } from "react";
import { updateProjectAction } from "@/lib/actions/projects";
import { Dialog, useDialogInline } from "./Dialog";
import { Icon } from "@/components/ui/Icon";

/** Редактирование названия, ключа и описания проекта (владелец / менеджер / админ). */
export function EditProjectDialog({
  projectId,
  name,
  projectKey,
  description,
}: {
  projectId: string;
  name: string;
  projectKey: string;
  description: string | null;
}) {
  const [open, setOpen] = useState(false);
  const inline = useDialogInline();
  const [state, formAction, pending] = useActionState(
    async (prev: { error?: string; ok?: boolean } | undefined, formData: FormData) => {
      const res = await updateProjectAction(projectId, prev, formData);
      if (!res.error) setOpen(false);
      return res;
    },
    undefined
  );

  const inputCls =
    "w-full rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm outline-none transition focus:border-accent";

  return (
    <>
      {!inline && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-tip="Редактировать проект"
          aria-label="Редактировать проект"
          className="rounded-lg p-1.5 text-muted transition hover:bg-surface-2 hover:text-foreground"
        >
          <Icon name="pencil" className="h-4 w-4" />
        </button>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="Название и описание">
        <form action={formAction}>
          <label className="mb-4 block">
            <span className="mb-1.5 block text-sm text-muted">Название *</span>
            <input
              name="name"
              required
              minLength={2}
              defaultValue={name}
              className={inputCls}
            />
          </label>

          <label className="mb-4 block">
            <span className="mb-1.5 block text-sm text-muted">
              Ключ * <span className="text-xs">· 2–6 латинских букв, префикс номеров задач</span>
            </span>
            <input
              name="key"
              required
              minLength={2}
              maxLength={6}
              pattern="[A-Za-z]+"
              defaultValue={projectKey}
              className={`${inputCls} font-mono uppercase`}
            />
          </label>

          <label className="mb-5 block">
            <span className="mb-1.5 block text-sm text-muted">Описание</span>
            <textarea
              name="description"
              rows={3}
              defaultValue={description ?? ""}
              placeholder="Цель проекта, контекст, ссылки…"
              className={`${inputCls} resize-y`}
            />
          </label>

          {state?.error && (
            <p className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger-text">
              {state.error}
            </p>
          )}

          <div className="flex justify-end gap-3">
            {!inline && (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-edge px-4 py-2 text-sm text-muted transition hover:bg-surface-2"
              >
                Отмена
              </button>
            )}
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold transition hover:bg-accent-hover disabled:opacity-50"
            >
              {pending ? "Сохраняем…" : "Сохранить"}
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
