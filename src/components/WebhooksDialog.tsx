"use client";

import { useActionState, useState } from "react";
import { Dialog, useDialogInline } from "./Dialog";
import {
  createWebhookAction,
  deleteWebhookAction,
  toggleWebhookAction,
  testWebhooksAction,
} from "@/lib/actions/webhooks";
import type { WebhookKind } from "@prisma/client";
import { Icon } from "@/components/ui/Icon";

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
  const inline = useDialogInline();
  const [kind, setKind] = useState<WebhookKind>("SLACK");
  const [state, formAction, pending] = useActionState(createWebhookAction, undefined);

  if (!canManage) return null;

  const inputCls =
    "w-full rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent";

  return (
    <>
      {!inline && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-tip="Интеграции: Slack / Telegram / webhooks"
          aria-label="Интеграции"
          className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-2 text-xs font-medium text-muted transition hover:bg-surface-2 hover:text-foreground"
        >
          <Icon name="link" className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Интеграции</span>
          {webhooks.length > 0 && (
            <span className="text-accent-hover">{webhooks.length}</span>
          )}
        </button>
      )}

      {/* Через портал в <body>: у меню «Ещё» анимация на transform, а такой
          предок становится containing block для position: fixed — окно
          сжималось до ширины выпадающей панели */}
      <Dialog open={open} onClose={() => setOpen(false)} title="Интеграции и вебхуки">
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
                    ? "bg-success/15 text-success-text"
                    : "bg-surface text-muted"
                }`}
              >
                {w.active ? "вкл" : "выкл"}
              </button>
              <button
                type="button"
                data-tip="Удалить"
                onClick={() => deleteWebhookAction(w.id)}
                className="shrink-0 text-muted transition hover:text-danger-text"
              >
                <Icon name="close" className="h-4 w-4" />
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
          {state?.error && <p className="text-sm text-danger-text">{state.error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-accent py-2 text-sm font-semibold transition hover:bg-accent-hover disabled:opacity-50"
          >
            {pending ? "Добавляем…" : "Добавить интеграцию"}
          </button>
          {/* Скрытые поля — в конце формы: Dialog ставит фокус на первый input, и скрытый, стоя первым, забрал бы его у видимых полей */}
          <input type="hidden" name="projectId" value={projectId} />
        </form>
      </Dialog>
    </>
  );
}
