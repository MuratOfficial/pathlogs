"use client";

import { useState, useTransition } from "react";
import { Dialog, useDialogInline } from "./Dialog";
import { togglePublicRoadmapAction } from "@/lib/actions/projects";
import { Icon } from "@/components/ui/Icon";

export function ShareRoadmapDialog({
  projectId,
  initialToken,
}: {
  projectId: string;
  initialToken: string | null;
}) {
  const [open, setOpen] = useState(false);
  const inline = useDialogInline();
  const [token, setToken] = useState(initialToken);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const url = token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/roadmap/${token}`
    : "";

  function toggle() {
    startTransition(async () => {
      const res = await togglePublicRoadmapAction(projectId);
      setToken(res.token);
      setCopied(false);
    });
  }

  function copy() {
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <>
      {!inline && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-tip="Публичная ссылка на роадмап"
          aria-label="Поделиться роадмапом"
          className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-2 text-xs font-medium text-muted transition hover:bg-surface-2 hover:text-foreground"
        >
          <Icon name="share" className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Поделиться</span>
        </button>
      )}

      {/* Через портал в <body>: у меню «Ещё» анимация на transform, а такой
          предок становится containing block для position: fixed — окно
          сжималось до ширины выпадающей панели */}
      <Dialog open={open} onClose={() => setOpen(false)} title="Публичный роадмап">
        <p className="mb-5 text-sm text-muted">
          Ссылка открывает роадмап проекта только для чтения — без входа. Кто угодно
          со ссылкой увидит задачи и их статусы.
        </p>

        {token ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm outline-none"
              />
              <button
                type="button"
                onClick={copy}
                className="shrink-0 rounded-lg bg-accent px-3 py-2 text-sm font-semibold transition hover:bg-accent-hover"
              >
                {copied ? "Скопировано" : "Копировать"}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-accent-hover hover:underline"
              >
                Открыть в новой вкладке ↗
              </a>
              <button
                type="button"
                onClick={toggle}
                disabled={pending}
                className="text-sm text-danger-text transition hover:text-danger-text disabled:opacity-50"
              >
                {pending ? "…" : "Отключить ссылку"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={toggle}
            disabled={pending}
            className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold transition hover:bg-accent-hover disabled:opacity-50"
          >
            {pending ? "Создание…" : "Создать публичную ссылку"}
          </button>
        )}

        {!inline && (
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-edge px-4 py-2 text-sm text-muted transition hover:text-foreground"
            >
              Закрыть
            </button>
          </div>
        )}
      </Dialog>
    </>
  );
}
