"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/** Компактное меню экспорта проекта: XLSX, PDF-отчёт, .ics — вместо трёх кнопок. */
export function ExportMenu({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const itemCls =
    "block rounded-lg px-3 py-2 text-sm text-foreground/90 transition hover:bg-surface-2";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Экспорт"
        className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-2 text-xs font-medium text-muted transition hover:bg-surface-2 hover:text-foreground"
      >
        <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        <span className="hidden sm:inline">Экспорт</span>
        <svg
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="animate-pop-in absolute right-0 z-40 mt-1.5 w-52 rounded-xl border border-edge bg-surface p-1.5 shadow-2xl">
          <a href={`/api/projects/${projectId}/export`} className={itemCls} onClick={() => setOpen(false)}>
            <span className="font-medium">XLSX</span>
            <span className="block text-xs text-muted">Задачи и трудозатраты</span>
          </a>
          <Link href={`/projects/${projectId}/report`} className={itemCls} onClick={() => setOpen(false)}>
            <span className="font-medium">PDF-отчёт</span>
            <span className="block text-xs text-muted">Печатная сводка</span>
          </Link>
          <a href={`/api/projects/${projectId}/ics`} className={itemCls} onClick={() => setOpen(false)}>
            <span className="font-medium">Календарь .ics</span>
            <span className="block text-xs text-muted">Google / Outlook / Apple</span>
          </a>
        </div>
      )}
    </div>
  );
}
