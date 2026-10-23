"use client";

import { useActionState, useState } from "react";
import { createCompanyAction } from "@/lib/actions/companies";
import { Dialog } from "@/components/Dialog";

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

      <Dialog open={open} onClose={() => setOpen(false)} title="Новая компания">
        <form action={formAction}>
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
            <p className="mb-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger-text">
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
      </Dialog>
    </>
  );
}
