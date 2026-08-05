"use client";

import { useActionState, useState } from "react";
import type { Role } from "@prisma/client";
import { resetUserPasswordAction, updateUserAction } from "@/lib/actions/admin";
import { ROLE_LABELS } from "@/lib/labels";

const inputCls =
  "w-full rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm outline-none transition focus:border-accent";

function ProfileTab({
  user,
  isSelf,
  onDone,
}: {
  user: { id: string; name: string; email: string; role: Role; active: boolean; hourlyRate: number | null };
  isSelf: boolean;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    async (prev: { error?: string; ok?: boolean } | undefined, formData: FormData) => {
      const res = await updateUserAction(user.id, prev, formData);
      if (res.ok) onDone();
      return res;
    },
    undefined
  );

  return (
    <form action={formAction}>
      <label className="mb-4 block">
        <span className="mb-1.5 block text-sm text-muted">Имя</span>
        <input name="name" required minLength={2} defaultValue={user.name} className={inputCls} />
      </label>
      <label className="mb-4 block">
        <span className="mb-1.5 block text-sm text-muted">Email</span>
        <input name="email" type="email" required defaultValue={user.email} className={inputCls} />
      </label>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1.5 block text-sm text-muted">Роль</span>
          <select
            name="role"
            defaultValue={user.role}
            disabled={isSelf}
            className={`${inputCls} disabled:opacity-50`}
          >
            {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-muted">Ставка, ₽/ч</span>
          <input
            name="hourlyRate"
            type="number"
            min={0}
            step="100"
            defaultValue={user.hourlyRate ?? ""}
            placeholder="не задана"
            className={inputCls}
          />
        </label>
      </div>
      <label
        className={`mb-5 flex items-center gap-2 text-sm ${isSelf ? "opacity-50" : "cursor-pointer"}`}
      >
        <input
          type="checkbox"
          name="active"
          defaultChecked={user.active}
          disabled={isSelf}
          className="accent-indigo-500"
        />
        Активен (может входить в систему)
      </label>

      {isSelf && (
        <p className="mb-4 rounded-lg border border-edge bg-surface-2 px-3 py-2 text-xs text-muted">
          Свою роль и активность изменить нельзя — иначе можно потерять доступ
          к администрированию.
        </p>
      )}
      {state?.error && (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold transition hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Сохраняем…" : "Сохранить"}
      </button>
    </form>
  );
}

function PasswordTab({ userId, userName }: { userId: string; userName: string }) {
  const [state, formAction, pending] = useActionState(
    async (prev: { error?: string; ok?: boolean } | undefined, formData: FormData) =>
      resetUserPasswordAction(userId, prev, formData),
    undefined
  );

  return (
    <form action={formAction} key={state?.ok ? "done" : "form"}>
      <p className="mb-4 text-sm text-muted">
        Задайте новый пароль для <b className="text-foreground">{userName}</b> и передайте
        его пользователю лично. Старый пароль перестанет работать сразу.
      </p>
      <label className="mb-4 block">
        <span className="mb-1.5 block text-sm text-muted">Новый пароль</span>
        <input
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className={inputCls}
        />
      </label>
      <label className="mb-5 block">
        <span className="mb-1.5 block text-sm text-muted">Повторите пароль</span>
        <input
          name="password2"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className={inputCls}
        />
      </label>

      {state?.error && (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
          Пароль обновлён.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold transition hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Сбрасываем…" : "Сбросить пароль"}
      </button>
    </form>
  );
}

/** Диалог админа: правка профиля пользователя и сброс его пароля. */
export function EditUserDialog({
  user,
  isSelf,
}: {
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
    active: boolean;
    hourlyRate: number | null;
  };
  isSelf: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"profile" | "password">("profile");

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setTab("profile");
          setOpen(true);
        }}
        data-tip="Редактировать пользователя"
        aria-label={`Редактировать ${user.name}`}
        className="rounded-lg p-1.5 text-muted transition hover:bg-surface-2 hover:text-foreground"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
        </svg>
      </button>

      {open && (
        <div
          className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="animate-pop-in w-full max-w-md rounded-2xl border border-edge bg-surface p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Пользователь</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Закрыть"
                className="text-muted transition hover:text-foreground"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-5 flex gap-1 rounded-xl border border-edge bg-surface-2/60 p-1">
              {(
                [
                  ["profile", "Профиль"],
                  ["password", "Пароль"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    tab === id
                      ? "bg-accent text-white"
                      : "text-muted hover:bg-surface hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "profile" ? (
              <ProfileTab user={user} isSelf={isSelf} onDone={() => setOpen(false)} />
            ) : (
              <PasswordTab userId={user.id} userName={user.name} />
            )}
          </div>
        </div>
      )}
    </>
  );
}
