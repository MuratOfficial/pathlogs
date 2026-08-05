"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export type ConfirmTone = "danger" | "accent";

const TONES: Record<
  ConfirmTone,
  { ring: string; icon: string; button: string; path: string }
> = {
  danger: {
    ring: "bg-red-500/15 text-red-400",
    icon: "text-red-400",
    button: "bg-red-500 text-white hover:bg-red-600",
    // восклицательный знак в треугольнике
    path: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z",
  },
  accent: {
    ring: "bg-accent/15 text-accent-hover",
    icon: "text-accent-hover",
    button: "bg-accent text-white hover:bg-accent-hover",
    // вопросительный знак в круге
    path: "M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z",
  },
};

/**
 * Модальное подтверждение вместо window.confirm.
 * Управляется снаружи через `open`; рендерится порталом в body,
 * поэтому не обрезается overflow-контейнерами (колонки доски, таблицы).
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Подтвердить",
  cancelLabel = "Отмена",
  tone = "danger",
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  // Портал требует DOM — при серверном рендере диалог всегда закрыт
  if (!open || typeof document === "undefined") return null;
  const t = TONES[tone];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="animate-fade-in fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && !pending && onCancel()}
    >
      <div className="animate-pop-in w-full max-w-sm rounded-2xl border border-edge bg-surface p-6 shadow-2xl">
        <div className="flex gap-4">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${t.ring}`}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d={t.path} />
            </svg>
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 className="text-base font-semibold leading-snug">{title}</h2>
            {message && (
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{message}</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2.5">
          <button
            type="button"
            disabled={pending}
            onClick={onCancel}
            className="rounded-lg border border-edge px-4 py-2 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-foreground disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            disabled={pending}
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-60 ${t.button}`}
          >
            {pending ? "Выполняем…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
