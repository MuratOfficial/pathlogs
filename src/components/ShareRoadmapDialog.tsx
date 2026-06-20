"use client";

import { useState, useTransition } from "react";
import { togglePublicRoadmapAction } from "@/lib/actions/projects";

export function ShareRoadmapDialog({
  projectId,
  initialToken,
}: {
  projectId: string;
  initialToken: string | null;
}) {
  const [open, setOpen] = useState(false);
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-tip="Публичная ссылка на роадмап"
        aria-label="Поделиться роадмапом"
        className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-2 text-xs font-medium text-muted transition hover:bg-surface-2 hover:text-foreground"
      >
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
        </svg>
        <span className="hidden sm:inline">Поделиться</span>
      </button>

      {open && (
        <div
          className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="animate-pop-in w-full max-w-md rounded-2xl border border-edge bg-surface p-6 shadow-2xl">
            <h2 className="mb-1 text-lg font-semibold">Публичный роадмап</h2>
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
                    className="text-sm text-red-400 transition hover:text-red-300 disabled:opacity-50"
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

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-edge px-4 py-2 text-sm text-muted transition hover:text-foreground"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
