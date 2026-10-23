"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export interface SectionTab {
  id: string;
  label: string;
  /** Счётчик рядом с подписью; ноль не показывается. */
  count?: number;
  content: ReactNode;
}

/**
 * Несколько родственных разделов в одной карточке, переключаемых вкладками.
 *
 * Открывается первая непустая вкладка: пустой раздел, показанный первым,
 * выглядел бы так, будто в карточке ничего нет. Неактивные панели остаются
 * в DOM (hidden) — набранный в их формах текст не теряется при переключении.
 */
export function SectionTabs({ label, tabs }: { label: string; tabs: SectionTab[] }) {
  const base = useId();
  const [active, setActive] = useState(
    () => (tabs.find((t) => (t.count ?? 0) > 0) ?? tabs[0])?.id
  );
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  // Стрелки влево/вправо ходят по вкладкам — как в любом tablist
  function onKeyDown(e: KeyboardEvent, index: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (index + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    setActive(tabs[next].id);
    buttons.current[next]?.focus();
  }

  return (
    <div>
      <div role="tablist" aria-label={label} className="mb-4 flex flex-wrap items-center gap-1">
        {tabs.map((t, i) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              ref={(el) => {
                buttons.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(t.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                selected ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
              }`}
            >
              {t.label}
              {t.count ? <span className="ml-1.5 tabular-nums opacity-70">{t.count}</span> : null}
            </button>
          );
        })}
      </div>
      {tabs.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`${base}-panel-${t.id}`}
          aria-labelledby={`${base}-tab-${t.id}`}
          hidden={t.id !== active}
        >
          {t.content}
        </div>
      ))}
    </div>
  );
}
