"use client";

import { useEffect, useRef, useState } from "react";
import { activeSectionId, type SectionPosition } from "@/lib/sections";

export interface TaskSectionDTO {
  /** id элемента-секции на странице задачи. */
  id: string;
  label: string;
  /** Количество элементов внутри — рисуется бейджем справа от названия. */
  count?: number;
}

/**
 * Липкая навигация по блокам карточки задачи: клик — плавный скролл к блоку,
 * активный пункт подсвечивается по мере прокрутки.
 *
 * Отступ при скролле берём у самой панели (её `top` из CSS + высота), поэтому
 * он корректен и на мобильных (панель липнет под шапкой), и на десктопе.
 */
export function TaskSectionNav({ sections }: { sections: TaskSectionDTO[] }) {
  const navRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string>(sections[0]?.id ?? "");

  function scrollOffset() {
    const el = navRef.current;
    if (!el) return 0;
    const stickyTop = parseFloat(getComputedStyle(el).top) || 0;
    return stickyTop + el.offsetHeight + 12;
  }

  useEffect(() => {
    let frame = 0;
    function recompute() {
      const positions: SectionPosition[] = [];
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (el) positions.push({ id: s.id, top: el.getBoundingClientRect().top });
      }
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      const next = activeSectionId(positions, scrollOffset() + 8, atBottom);
      if (next) setActive(next);
    }
    function onScroll() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(recompute);
    }
    recompute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [sections]);

  function go(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    setActive(id);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({
      top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - scrollOffset()),
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }

  return (
    <div ref={navRef} className="sticky top-16 z-20 mb-4 lg:top-3">
      <nav
        aria-label="Разделы задачи"
        className="no-scrollbar flex flex-nowrap gap-1 overflow-x-auto rounded-xl border border-edge bg-surface/95 p-1 shadow-sm backdrop-blur"
      >
        {sections.map((s) => {
          const on = active === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => go(s.id)}
              aria-current={on ? "true" : undefined}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                on
                  ? "bg-accent text-white"
                  : "text-muted hover:bg-surface-2 hover:text-foreground"
              }`}
            >
              {s.label}
              {s.count !== undefined && (
                <span
                  className={`rounded-full px-1.5 text-[10px] font-semibold tabular-nums ${
                    on ? "bg-white/20 text-white" : "bg-surface-2 text-muted"
                  }`}
                >
                  {s.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
