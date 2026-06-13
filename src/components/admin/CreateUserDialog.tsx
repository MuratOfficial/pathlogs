"use client";

import { useActionState, useState } from "react";
import { createUserAction } from "@/lib/actions/admin";
import { ROLE_LABELS } from "@/lib/labels";
import type { Role } from "@prisma/client";

export function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prev: { error?: string } | undefined, formData: FormData) => {
      const res = await createUserAction(prev, formData);
      if (!res.error) setOpen(false);
      return res;
    },
    undefined
  );

  const inputCls =
    "w-full rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold transition hover:bg-accent-hover"
      >
        + Пользователь
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
            <h2 className="mb-5 text-lg font-semibold">Новый пользователь</h2>

            <label className="mb-4 block">
              <span className="mb-1.5 block text-sm text-muted">Имя</span>
              <input name="name" required minLength={2} className={inputCls} />
            </label>
            <label className="mb-4 block">
              <span className="mb-1.5 block text-sm text-muted">Email</span>
              <input name="email" type="email" required className={inputCls} />
            </label>
            <label className="mb-4 block">
              <span className="mb-1.5 block text-sm text-muted">Пароль</span>
              <input name="password" type="password" required minLength={6} className={inputCls} />
            </label>
            <label className="mb-5 block">
              <span className="mb-1.5 block text-sm text-muted">Роль</span>
              <select name="role" defaultValue="DEVELOPER" className={inputCls}>
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
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
