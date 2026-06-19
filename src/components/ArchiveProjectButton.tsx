"use client";

import { useTransition } from "react";
import { toggleProjectArchiveAction } from "@/lib/actions/projects";

export function ArchiveProjectButton({
  projectId,
  archived,
}: {
  projectId: string;
  archived: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      data-tip={archived ? "Восстановить из архива" : "В архив"}
      disabled={pending}
      onClick={(e) => {
        e.preventDefault();
        startTransition(() => toggleProjectArchiveAction(projectId));
      }}
      className="rounded-lg p-1.5 text-muted transition hover:bg-surface-2 hover:text-foreground disabled:opacity-50"
    >
      {archived ? (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
      )}
    </button>
  );
}
