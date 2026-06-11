"use client";

import { useActionState, useState } from "react";
import { createProjectAction } from "@/lib/actions/projects";

export function NewProjectDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createProjectAction, undefined);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold transition hover:bg-accent-hover"
      >
        + Новый проект
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <form
            action={formAction}
            className="w-full max-w-md rounded-2xl border border-edge bg-surface p-6 shadow-2xl"
          >
            <h2 className="mb-5 text-lg font-semibold">Новый проект</h2>

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
                {pending ? "Создаём…" : "Создать"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
