"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { searchAction, type SearchResult } from "@/lib/actions/search";

const NAV = [
  { label: "Проекты", href: "/dashboard", keys: "g d" },
  { label: "Мои задачи", href: "/my", keys: "g m" },
  { label: "Уведомления", href: "/notifications", keys: "g n" },
  { label: "Профиль", href: "/profile", keys: "g p" },
];

type Item = {
  id: string;
  group: string;
  title: string;
  badge?: string;
  hint?: string;
  href: string;
};

/** Командная палитра (⌘K / Ctrl+K): быстрый переход к проектам, задачам и разделам. */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult>({ projects: [], tasks: [] });
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Открытие/закрытие по ⌘K / Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("cmdk:open", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("cmdk:open", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  // Поиск с дебаунсом
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      searchAction(query).then((r) => {
        setResults(r);
        setActive(0);
      });
    }, 150);
    return () => clearTimeout(t);
  }, [query, open]);

  const ql = query.trim().toLowerCase();
  const navItems: Item[] = NAV.filter(
    (n) => !ql || n.label.toLowerCase().includes(ql)
  ).map((n) => ({ id: "nav:" + n.href, group: "Навигация", title: n.label, hint: n.keys, href: n.href }));
  const projItems: Item[] = results.projects.map((p) => ({
    id: "p:" + p.id,
    group: "Проекты",
    title: p.name,
    badge: p.key,
    href: `/projects/${p.id}`,
  }));
  const taskItems: Item[] = results.tasks.map((t) => ({
    id: "t:" + t.id,
    group: "Задачи",
    title: t.title,
    badge: `${t.projectKey}-${t.number}`,
    href: `/tasks/${t.id}`,
  }));
  const items = [...navItems, ...projItems, ...taskItems];

  function go(item?: Item) {
    const it = item ?? items[active];
    if (!it) return;
    setOpen(false);
    router.push(it.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  // Прокрутка активного элемента в зону видимости
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  if (!open) return null;

  let lastGroup = "";

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[70] flex items-start justify-center bg-black/60 p-4 pt-[12vh] backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && setOpen(false)}
    >
      <div className="animate-pop-in w-full max-w-xl overflow-hidden rounded-2xl border border-edge bg-surface shadow-2xl">
        <div className="flex items-center gap-2.5 border-b border-edge px-4">
          <svg className="h-4 w-4 shrink-0 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Поиск проектов, задач, разделов…"
            className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-muted"
          />
          <kbd className="hidden shrink-0 rounded border border-edge bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted sm:block">
            Esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[55vh] overflow-y-auto p-1.5">
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted">Ничего не найдено</p>
          ) : (
            items.map((it, i) => {
              const showGroup = it.group !== lastGroup;
              lastGroup = it.group;
              return (
                <div key={it.id}>
                  {showGroup && (
                    <p className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
                      {it.group}
                    </p>
                  )}
                  <button
                    type="button"
                    data-idx={i}
                    onMouseMove={() => setActive(i)}
                    onClick={() => go(it)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition ${
                      i === active ? "bg-accent/15 text-foreground" : "text-foreground/90"
                    }`}
                  >
                    {it.badge && (
                      <span className="shrink-0 rounded-md bg-accent/15 px-1.5 py-0.5 font-mono text-[11px] font-bold text-accent-hover">
                        {it.badge}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate">{it.title}</span>
                    {it.hint && (
                      <kbd className="shrink-0 rounded border border-edge bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted">
                        {it.hint}
                      </kbd>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-edge px-3 py-2 text-[11px] text-muted">
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-edge bg-surface-2 px-1 font-mono">↑</kbd>
            <kbd className="rounded border border-edge bg-surface-2 px-1 font-mono">↓</kbd>
            навигация
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-edge bg-surface-2 px-1 font-mono">↵</kbd>
            открыть
          </span>
        </div>
      </div>
    </div>
  );
}
