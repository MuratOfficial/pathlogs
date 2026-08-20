"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Складка для второстепенных действий: кнопка «Ещё» и выпадающая панель.
 *
 * Внутрь кладут готовые кнопки-триггеры диалогов как есть — им не нужно ничего
 * знать про меню. Панель абсолютная и не растягивает шапку.
 *
 * Пока открыт диалог, меню не закрывается — и это не косметика: диалоги живут
 * внутри панели, и её размонтирование уносило бы их с собой, так что окно
 * не успевало появиться. Поэтому закрытие меню пропускается, если на экране
 * есть модальное окно; оно перекрывает панель собой.
 */
export function MoreMenu({
  children,
  label = "Ещё",
  count,
}: {
  children: ReactNode;
  label?: string;
  /** Сколько действий спрятано — показывается на кнопке. */
  count?: number;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Открытое модальное окно — сигнал не трогать меню: клик и Escape
    // адресованы окну, а не нам
    // Модальные окна приложения — это перекрывающая экран подложка
    const modalOpen = () => Boolean(document.querySelector(".fixed.inset-0"));

    function onDown(e: MouseEvent) {
      const target = e.target as Element | null;
      if (target?.closest(".fixed")) return;
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !modalOpen()) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        data-tip={open ? undefined : "Остальные действия"}
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition ${
          open
            ? "border-accent/60 bg-surface-2 text-foreground"
            : "border-edge text-muted hover:bg-surface-2 hover:text-foreground"
        }`}
      >
        <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path d="M5 10a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM11.5 10a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM18 10a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
        </svg>
        <span className="hidden sm:inline">{label}</span>
        {count ? <span className="text-[10px] tabular-nums opacity-70">{count}</span> : null}
      </button>

      {open && (
        <div className="animate-pop-in absolute right-0 top-full z-40 mt-1.5 flex w-56 flex-col gap-1 rounded-xl border border-edge bg-surface p-2 shadow-2xl">
          {children}
        </div>
      )}
    </div>
  );
}
