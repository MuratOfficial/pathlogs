"use client";

import { useActionState, useState, type ReactNode } from "react";
import { createProjectAction } from "@/lib/actions/projects";
import { Dialog } from "./Dialog";

export function NewProjectDialog({
  triggerLabel = "+ Новый проект",
  triggerClassName = "rounded-lg bg-accent px-4 py-2 text-sm font-semibold transition hover:bg-accent-hover",
}: {
  /** Своя подпись кнопки — например, пункт меню вместо отдельной кнопки. */
  triggerLabel?: ReactNode;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createProjectAction, undefined);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName}>
        {triggerLabel}
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Новый проект">
        <form action={formAction}>
          <label className="mb-4 block">
            <span className="mb-1.5 block text-sm text-muted">Название</span>
            <input
              name="name"
              required
              minLength={2}
              placeholder="Платёжный сервис"
              className="w-full rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </label>

          <label className="mb-4 block">
            <span className="mb-1.5 block text-sm text-muted">
              Ключ (2–6 латинских букв, как в Jira)
            </span>
            <input
              name="key"
              required
              minLength={2}
              maxLength={6}
              pattern="[A-Za-z]+"
              placeholder="PAY"
              className="w-full rounded-lg border border-edge bg-surface-2 px-3 py-2 font-mono text-sm uppercase outline-none focus:border-accent"
            />
          </label>

          <label className="mb-5 block">
            <span className="mb-1.5 block text-sm text-muted">Описание</span>
            <textarea
              name="description"
              rows={3}
              placeholder="Кратко о целях проекта…"
              className="w-full resize-none rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </label>

          {state?.error && (
            <p className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger-text">
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
              {pending ? "Создаём…" : "Создать"}
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
