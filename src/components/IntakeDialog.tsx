"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { disableIntakeAction, enableIntakeAction } from "@/lib/actions/intake";
import type { ColumnDTO } from "@/lib/types";

/**
 * Управление приёмом заявок: включить, выбрать колонку-приёмник, скопировать
 * ссылку. Ссылка при выключении не теряется — включив обратно, раздавать
 * заново её не придётся.
 */
export function IntakeDialog({
  projectId,
  columns,
  initial,
}: {
  projectId: string;
  columns: ColumnDTO[];
  initial: { token: string; columnId: string | null; active: boolean } | null;
}) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState(initial?.active ? initial.token : null);
  const [columnId, setColumnId] = useState(initial?.columnId ?? "");
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const url = token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/intake/${token}`
    : "";

  function enable(nextColumn: string) {
    startTransition(async () => {
      const res = await enableIntakeAction(projectId, nextColumn || null);
      setToken(res.token);
      setCopied(false);
    });
  }

  function disable() {
    startTransition(async () => {
      await disableIntakeAction(projectId);
      setToken(null);
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
        data-tip="Публичная форма приёма заявок"
        className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-2 text-xs font-medium text-muted transition hover:bg-surface-2 hover:text-foreground"
      >
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
        </svg>
        <span className="hidden sm:inline">Заявки</span>
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && setOpen(false)}
          >
            <div className="animate-pop-in w-full max-w-md rounded-2xl border border-edge bg-surface p-6 shadow-2xl">
              <h2 className="mb-1 text-lg font-semibold">Приём заявок</h2>
              <p className="mb-5 text-sm text-muted">
                По ссылке любой человек без входа в систему оставит заявку — она станет
                задачей проекта. Сам проект по этой ссылке не виден.
              </p>

              <label className="mb-4 block">
                <span className="mb-1 block text-xs text-muted">Заявки попадают в колонку</span>
                <select
                  value={columnId}
                  onChange={(e) => {
                    setColumnId(e.target.value);
                    if (token) enable(e.target.value);
                  }}
                  className="w-full rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                >
                  <option value="">Первая колонка «К выполнению»</option>
                  {columns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              {token ? (
                <>
                  <div className="mb-3 flex gap-2">
                    <input
                      readOnly
                      value={url}
                      onFocus={(e) => e.currentTarget.select()}
                      className="min-w-0 flex-1 rounded-lg border border-edge bg-surface-2 px-3 py-2 font-mono text-xs outline-none"
                    />
                    <button
                      type="button"
                      onClick={copy}
                      className="shrink-0 rounded-lg bg-accent px-3 py-2 text-sm font-semibold transition hover:bg-accent-hover"
                    >
                      {copied ? "Скопировано" : "Копировать"}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={disable}
                    disabled={pending}
                    className="w-full rounded-lg border border-red-500/30 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
                  >
                    Закрыть приём заявок
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => enable(columnId)}
                  disabled={pending}
                  className="w-full rounded-lg bg-accent py-2 text-sm font-semibold transition hover:bg-accent-hover disabled:opacity-50"
                >
                  {pending ? "Включаем…" : "Открыть приём заявок"}
                </button>
              )}

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-3 w-full rounded-lg border border-edge py-2 text-sm text-muted transition hover:bg-surface-2 hover:text-foreground"
              >
                Закрыть
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
