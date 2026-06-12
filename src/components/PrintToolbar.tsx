"use client";

import Link from "next/link";

/** Панель печатного отчёта: «назад» и «Сохранить как PDF». Скрыта при печати. */
export function PrintToolbar({ backHref }: { backHref: string }) {
  return (
    <div className="mb-6 flex items-center justify-between print:hidden">
      <Link
        href={backHref}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100"
      >
        ← К проекту
      </Link>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
      >
        Сохранить как PDF / печать
      </button>
    </div>
  );
}
