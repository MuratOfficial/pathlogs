"use client";

import { useActionState, useState } from "react";
import {
  createWebhookAction,
  deleteWebhookAction,
  toggleWebhookAction,
  testWebhooksAction,
} from "@/lib/actions/webhooks";
import type { WebhookKind } from "@prisma/client";

export interface WebhookDTO {
  id: string;
  kind: WebhookKind;
  url: string;
  target: string | null;
  active: boolean;
}

const KIND_LABELS: Record<WebhookKind, string> = {
  SLACK: "Slack",
  TELEGRAM: "Telegram",
  GENERIC: "JSON (generic)",
};

export function WebhooksDialog({
  projectId,
  webhooks,
  canManage,
}: {
  projectId: string;
  webhooks: WebhookDTO[];
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<WebhookKind>("SLACK");
  const [state, formAction, pending] = useActionState(createWebhookAction, undefined);

  if (!canManage) return null;

  const inputCls =
    "w-full rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Интеграции: Slack / Telegram / webhooks"
        className="rounded-lg border border-edge px-3 py-2 text-xs font-medium text-muted transition hover:bg-surface-2 hover:text-foreground"
      >
        Интеграции
        {webhooks.length > 0 && (
          <span className="ml-1.5 text-accent-hover">{webhooks.length}</span>
        )}
      </button>

      {open && (
        <div
          className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="animate-pop-in max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-edge bg-surface p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Интеграции и вебхуки</h2>
              <button onClick={() => setOpen(false)} className="text-muted hover:text-foreground">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="mb-4 text-xs text-muted">
              События задач (назначения, комментарии, патч-логи, смена статуса)
              отправляются в подключённые каналы.
            </p>

            <ul className="mb-4 space-y-2">
              {webhooks.map((w) => (
                <li
                  key={w.id}
                  className="flex items-center gap-3 rounded-xl border border-edge bg-surface-2/50 px-4 py-2.5"
                >
                  <span className="rounded bg-surface px-2 py-0.5 text-xs font-semibold">
                    {KIND_LABELS[w.kind]}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted">
                    {w.url}
                    {w.target ? ` · ${w.target}` : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleWebhookAction(w.id)}
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      w.active
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-surface text-muted"
                    }`}
                  >
                    {w.active ? "вкл" : "выкл"}
                  </button>
                  <button
                    type="button"
                    title="Удалить"
                    onClick={() => deleteWebhookAction(w.id)}
                    className="shrink-0 text-muted transition hover:text-red-400"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              ))}
              {webhooks.length === 0 && (
                <p className="text-sm text-muted">Интеграций пока нет.</p>
              )}
            </ul>

            {webhooks.length > 0 && (
              <button
                type="button"
                onClick={() => testWebhooksAction(projectId)}
                className="mb-4 w-full rounded-lg border border-edge py-2 text-sm text-muted transition hover:bg-surface-2 hover:text-foreground"
              >
                Отправить тестовое сообщение
              </button>
            )}

            <form action={formAction} className="space-y-3 rounded-xl border border-edge bg-surface-2/40 p-4">
              <input type="hidden" name="projectId" value={projectId} />
              <label className="block">
                <span className="mb-1 block text-xs text-muted">Тип</span>
                <select
                  name="kind"
                  value={kind}
                  onChange={(e) => setKind(e.target.value as WebhookKind)}
                  className={inputCls}
                >
                  {(Object.keys(KIND_LABELS) as WebhookKind[]).map((k) => (
                    <option key={k} value={k}>{KIND_LABELS[k]}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted">
                  {kind === "TELEGRAM"
                    ? "URL Bot API (https://api.telegram.org/bot<token>/sendMessage)"
                    : kind === "SLACK"
                      ? "Slack Incoming Webhook URL"
                      : "URL приёмника (POST JSON)"}
                </span>
                <input name="url" required placeholder="https://…" className={inputCls} />
              </label>
              {kind === "TELEGRAM" && (
                <label className="block">
                  <span className="mb-1 block text-xs text-muted">chat_id</span>
                  <input name="target" placeholder="-1001234567890" className={inputCls} />
                </label>
              )}
              {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-lg bg-accent py-2 text-sm font-semibold transition hover:bg-accent-hover disabled:opacity-50"
              >
                {pending ? "Добавляем…" : "Добавить интеграцию"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
