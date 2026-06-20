"use client";

/** Кнопка в сайдбаре, открывающая командную палитру (⌘K) — для мыши и тача. */
export function SearchTrigger() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("cmdk:open"))}
      className="mx-3 mb-2 flex items-center gap-2.5 rounded-lg border border-edge bg-surface-2/50 px-3 py-2 text-sm text-muted transition hover:border-accent/50 hover:text-foreground"
    >
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
      <span className="flex-1 text-left">Поиск…</span>
      <kbd className="hidden rounded border border-edge bg-surface px-1.5 py-0.5 font-mono text-[10px] lg:block">
        ⌘K
      </kbd>
    </button>
  );
}
