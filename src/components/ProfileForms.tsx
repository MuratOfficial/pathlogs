"use client";

import { useActionState } from "react";
import { updateProfileAction, changePasswordAction } from "@/lib/actions/auth";

const inputCls =
  "w-full rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm outline-none transition focus:border-accent";

function Feedback({ state }: { state?: { error?: string; success?: string } }) {
  if (!state?.error && !state?.success) return null;
  return state.error ? (
    <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
      {state.error}
    </p>
  ) : (
    <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
      {state.success}
    </p>
  );
}

export function ProfileNameForm({ name }: { name: string }) {
  const [state, formAction, pending] = useActionState(updateProfileAction, undefined);
  return (
    <form action={formAction} className="space-y-3">
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">Имя</span>
        <input name="name" defaultValue={name} required minLength={2} className={inputCls} />
      </label>
      <Feedback state={state} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold transition hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Сохраняем…" : "Сохранить"}
      </button>
    </form>
  );
}

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [state, formAction, pending] = useActionState(changePasswordAction, undefined);
  return (
    <form action={formAction} className="space-y-3">
      {hasPassword ? (
        <label className="block">
          <span className="mb-1.5 block text-sm text-muted">Текущий пароль</span>
          <input name="current" type="password" required autoComplete="current-password" className={inputCls} />
        </label>
      ) : (
        <p className="text-sm text-muted">
          Вы входите через Google — установите пароль, чтобы входить и по email.
        </p>
      )}
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">Новый пароль</span>
        <input name="next" type="password" required minLength={6} autoComplete="new-password" className={inputCls} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">Повторите пароль</span>
        <input name="confirm" type="password" required minLength={6} autoComplete="new-password" className={inputCls} />
      </label>
      <Feedback state={state} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold transition hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Сохраняем…" : hasPassword ? "Сменить пароль" : "Установить пароль"}
      </button>
    </form>
  );
}
