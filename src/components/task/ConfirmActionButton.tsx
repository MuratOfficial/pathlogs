"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function ConfirmActionButton({
  action,
  confirmText,
  label,
  small = false,
  redirectTo,
}: {
  action: () => Promise<void>;
  confirmText: string;
  label?: string;
  small?: boolean;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run() {
    if (!confirm(confirmText)) return;
    startTransition(async () => {
      await action();
      if (redirectTo) router.push(redirectTo);
    });
  }

  if (label) {
    return (
      <button
        onClick={run}
        disabled={pending}
        className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
      >
        {pending ? "Удаляем…" : label}
      </button>
    );
  }

  return (
    <button
      onClick={run}
      disabled={pending}
      title={confirmText}
      className={`shrink-0 rounded p-1 text-muted transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50 ${
        small ? "" : "p-1.5"
      }`}
    >
      <svg className={small ? "h-3 w-3" : "h-3.5 w-3.5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
      </svg>
    </button>
  );
}
