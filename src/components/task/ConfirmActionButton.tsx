"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";

export function ConfirmActionButton({
  action,
  confirmText,
  confirmTitle = "Подтвердите действие",
  confirmLabel = "Удалить",
  label,
  small = false,
  redirectTo,
}: {
  action: () => Promise<void>;
  /** Текст-пояснение в диалоге (он же — подсказка на иконке). */
  confirmText: string;
  confirmTitle?: string;
  confirmLabel?: string;
  label?: string;
  small?: boolean;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [asking, setAsking] = useState(false);

  function run() {
    startTransition(async () => {
      await action();
      setAsking(false);
      if (redirectTo) router.push(redirectTo);
    });
  }

  const dialog = (
    <ConfirmDialog
      open={asking}
      title={confirmTitle}
      message={confirmText}
      confirmLabel={confirmLabel}
      pending={pending}
      onConfirm={run}
      onCancel={() => setAsking(false)}
    />
  );

  if (label) {
    return (
      <>
        <button
          onClick={() => setAsking(true)}
          disabled={pending}
          className="rounded-lg border border-danger/30 px-3 py-1.5 text-xs font-medium text-danger-text transition hover:bg-danger/10 disabled:opacity-50"
        >
          {pending ? "Удаляем…" : label}
        </button>
        {dialog}
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setAsking(true)}
        disabled={pending}
        data-tip={confirmText}
        aria-label={confirmText}
        className={`shrink-0 rounded p-1 text-muted transition hover:bg-danger/10 hover:text-danger-text disabled:opacity-50 ${
          small ? "" : "p-1.5"
        }`}
      >
        <Icon name="trash" className={small ? "h-3 w-3" : "h-3.5 w-3.5"} />
      </button>
      {dialog}
    </>
  );
}
