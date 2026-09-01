"use client";

import { useActionState, useState } from "react";
import { createCompanyAction } from "@/lib/actions/companies";

/** Создание компании — доступно администраторам и менеджерам. */
export function NewCompanyDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prev: { error?: string } | undefined, formData: FormData) => {
      const res = await createCompanyAction(prev, formData);
      if (!res.error) setOpen(false);
      return res;
    },
    undefined
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold transition hover:bg-accent-hover"
      >
        + Компания
      </button>

      {open && (
        <div
          className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <form
            action={formAction}
            className="animate-pop-in w-full max-w-md rounded-2xl border border-edge bg-surface p-6 shadow-2xl"
          >
            <h2 className="mb-5 text-lg font-semibold">Новая компания</h2>

            <label className="mb-4 block">
              <span className="mb-1.5 block text-sm text-muted">Название</span>
              <input
                name="name"
                required
                minLength={2}
                maxLength={80}
                autoFocus
                placeholder="ТОО BAS"
                className="w-full rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </label>

            {state?.error && (
              <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {state.error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-edge px-4 py-2 text-sm text-muted transition hover:bg-surface-2 hover:text-foreground"
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
