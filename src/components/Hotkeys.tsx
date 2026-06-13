"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: "g d", label: "Проекты (дашборд)" },
  { keys: "g m", label: "Мои задачи" },
  { keys: "g n", label: "Уведомления" },
  { keys: "g p", label: "Профиль" },
  { keys: "?", label: "Эта подсказка" },
  { keys: "Esc", label: "Закрыть подсказку" },
];

/** Глобальные горячие клавиши с «лидером» g (g d, g m, …) и помощью по «?». */
export function Hotkeys() {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    let leader = false;
    let leaderTimer: ReturnType<typeof setTimeout> | null = null;

    function isTyping(el: EventTarget | null) {
      const node = el as HTMLElement | null;
      if (!node) return false;
      const tag = node.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        node.isContentEditable
      );
    }

    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTyping(e.target)) return;

      if (e.key === "Escape") {
        setHelpOpen(false);
        return;
      }
      if (e.key === "?") {
        e.preventDefault();
        setHelpOpen((v) => !v);
        return;
      }

      if (leader) {
        leader = false;
        if (leaderTimer) clearTimeout(leaderTimer);
        const routes: Record<string, string> = {
          d: "/dashboard",
          m: "/my",
          n: "/notifications",
          p: "/profile",
        };
        const path = routes[e.key.toLowerCase()];
        if (path) {
          e.preventDefault();
          router.push(path);
        }
        return;
      }

      if (e.key.toLowerCase() === "g") {
        leader = true;
        leaderTimer = setTimeout(() => {
          leader = false;
        }, 1200);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  if (!helpOpen) return null;

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && setHelpOpen(false)}
    >
      <div className="animate-pop-in w-full max-w-sm rounded-2xl border border-edge bg-surface p-6 shadow-2xl">
        <h2 className="mb-4 text-lg font-semibold">Горячие клавиши</h2>
        <ul className="space-y-2">
          {SHORTCUTS.map((s) => (
            <li key={s.keys} className="flex items-center justify-between text-sm">
              <span className="text-muted">{s.label}</span>
              <kbd className="rounded border border-edge bg-surface-2 px-2 py-0.5 font-mono text-xs">
                {s.keys}
              </kbd>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted">
          «g» — лидер: нажмите g, затем вторую клавишу.
        </p>
      </div>
    </div>
  );
}
