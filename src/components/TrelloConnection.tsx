"use client";

import { useActionState, useState } from "react";
import {
  saveTrelloCredentialsAction,
  deleteTrelloCredentialsAction,
} from "@/lib/actions/trello";
import { buildTrelloAuthorizeUrl } from "@/lib/trello";

const inputCls =
  "w-full rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm outline-none transition focus:border-accent";

export function TrelloConnection({ connected }: { connected: boolean }) {
  const [editing, setEditing] = useState(false);
  const [key, setKey] = useState("");
  const [state, formAction, pending] = useActionState(
    async (prev: { error?: string; ok?: boolean } | undefined, formData: FormData) => {
      const res = await saveTrelloCredentialsAction(prev, formData);
      if (res.ok) setEditing(false);
      return res;
    },
    undefined
  );

  if (connected && !editing) {
    return (
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Trello подключён — при импорте доски не нужно вводить ключ и токен.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-lg border border-edge px-2.5 py-1 text-xs text-muted transition hover:bg-surface-2 hover:text-foreground"
          >
            Обновить
          </button>
          <button
            type="button"
            onClick={() => deleteTrelloCredentialsAction()}
            className="rounded-lg border border-edge px-2.5 py-1 text-xs text-muted transition hover:border-red-500/40 hover:text-red-400"
          >
            Отключить
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <p className="text-xs text-muted">
        Ключ и токен возьмите на{" "}
        <a
          href="https://trello.com/power-ups/admin"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-hover underline"
        >
          trello.com/power-ups/admin
        </a>
        . Хранятся в зашифрованном виде, используются только для импорта досок.
      </p>
      <label className="block">
        <span className="mb-1 block text-xs text-muted">API key *</span>
        <input
          name="key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="0123456789abcdef…"
          className={`${inputCls} font-mono`}
        />
      </label>
      <button
        type="button"
        disabled={key.trim().length < 8}
        onClick={() =>
          window.open(buildTrelloAuthorizeUrl(key), "_blank", "noopener,noreferrer")
        }
        className="text-xs text-accent-hover underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
      >
        Получить токен в Trello → скопируйте и вставьте ниже
      </button>
      <label className="block">
        <span className="mb-1 block text-xs text-muted">Token *</span>
        <input name="token" placeholder="ATTA…" className={`${inputCls} font-mono`} />
      </label>
      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      <div className="flex justify-end gap-2">
        {connected && (
          <button
            type="button"
            onClick={() => setEditing(false)}
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
          {pending ? "Проверяем…" : "Подключить"}
        </button>
      </div>
    </form>
  );
}
