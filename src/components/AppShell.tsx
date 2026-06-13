"use client";

import { useState } from "react";

/**
 * Оболочка приложения с адаптивным сайдбаром: на десктопе (lg+) — статичный
 * фиксированный сайдбар; на узких экранах — выезжающий drawer с верхней панелью
 * и кнопкой-гамбургером. Контент сайдбара приходит пропом `sidebar`.
 */
export function AppShell({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Верхняя панель (мобильные) */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-edge bg-surface/90 px-4 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Открыть меню"
          className="rounded-lg p-1.5 text-muted transition hover:bg-surface-2 hover:text-foreground"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <span className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-accent via-accent-2 to-accent-pink text-sm font-bold text-white">
            P
          </span>
          <span className="text-sm font-bold tracking-tight">PathLogs</span>
        </span>
      </header>

      {/* Затемнение при открытом drawer */}
      {open && (
        <div
          className="animate-fade-in fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* Сайдбар: drawer на мобильных, статичный на lg+ (см. .app-sidebar в globals.css) */}
      <aside
        // Клик по любой ссылке внутри закрывает drawer (на мобильных)
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) setOpen(false);
        }}
        className={`app-sidebar fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-edge bg-surface ${
          open ? "shadow-2xl" : ""
        }`}
        style={{ transform: open ? "translateX(0)" : "translateX(-100%)" }}
      >
        {sidebar}
      </aside>

      <main className="min-w-0 flex-1 px-4 pb-6 pt-20 lg:ml-60 lg:px-8 lg:pt-6">
        {children}
      </main>
    </div>
  );
}
