"use client";

import { useActionState, useState } from "react";
import { createApiTokenAction, revokeApiTokenAction } from "@/lib/actions/tokens";

export interface ApiTokenDTO {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export function ApiTokens({ tokens }: { tokens: ApiTokenDTO[] }) {
  const [state, formAction, pending] = useActionState(createApiTokenAction, undefined);
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {tokens.map((t) => (
          <li
            key={t.id}
            className="flex items-center gap-3 rounded-xl border border-edge bg-surface-2/50 px-4 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t.name}</p>
              <p className="font-mono text-xs text-muted">
                {t.prefix}…
                {t.lastUsedAt
                  ? ` · использован ${t.lastUsedAt}`
                  : " · ещё не использовался"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => revokeApiTokenAction(t.id)}
              className="shrink-0 rounded-lg border border-edge px-2.5 py-1 text-xs text-muted transition hover:border-red-500/40 hover:text-red-400"
            >
              Отозвать
            </button>
          </li>
        ))}
        {tokens.length === 0 && (
          <p className="text-sm text-muted">
            Токенов нет. Создайте токен для git-вебхука, экспортных эндпоинтов и
            интеграций.
          </p>
        )}
      </ul>

      {state?.token && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="mb-2 text-sm font-medium text-emerald-400">
            Токен создан. Скопируйте его сейчас — больше он не покажется:
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-surface px-3 py-2 font-mono text-xs">
              {state.token}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(state.token!);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="shrink-0 rounded-lg bg-accent px-3 py-2 text-xs font-semibold transition hover:bg-accent-hover"
            >
              {copied ? "Скопировано" : "Копировать"}
            </button>
          </div>
        </div>
      )}

      <form action={formAction} className="flex items-end gap-2">
        <label className="flex-1">
          <span className="mb-1.5 block text-sm text-muted">Новый токен</span>
          <input
            name="name"
            required
            minLength={2}
            placeholder="CI деплой, ноутбук, бот…"
            className="w-full rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm outline-none transition focus:border-accent"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold transition hover:bg-accent-hover disabled:opacity-50"
        >
          {pending ? "Создаём…" : "Создать"}
        </button>
      </form>
      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
    </div>
  );
}
