"use client";

import { useState, useTransition } from "react";
import type { MemberDTO } from "@/lib/types";
import {
  addProjectMemberAction,
  removeProjectMemberAction,
} from "@/lib/actions/projects";
import { initials } from "@/lib/labels";

export function ProjectMembersDialog({
  projectId,
  ownerId,
  members,
  candidates,
  canManage,
}: {
  projectId: string;
  ownerId: string;
  members: MemberDTO[];
  /** Активные пользователи, которых ещё нет в проекте (только для менеджеров). */
  candidates: MemberDTO[];
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("");
  const [pending, startTransition] = useTransition();

  function add() {
    if (!selected) return;
    const userId = selected;
    setSelected("");
    startTransition(() => addProjectMemberAction(projectId, userId));
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-edge px-3 py-2 text-sm text-muted transition hover:bg-surface-2 hover:text-foreground"
        title="Участники проекта"
      >
        Участники · {members.length}
      </button>

      {open && (
        <div
          className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="animate-pop-in w-full max-w-md rounded-2xl border border-edge bg-surface p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Участники проекта</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-muted transition hover:text-foreground"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {members.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-3 rounded-xl border border-edge bg-surface-2/50 px-3 py-2"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/25 text-[11px] font-bold text-accent-hover">
                    {initials(m.name)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{m.name}</span>
                  {m.id === ownerId ? (
                    <span className="rounded bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent-hover">
                      владелец
                    </span>
                  ) : (
                    canManage && (
                      <button
                        type="button"
                        disabled={pending}
                        title="Исключить из проекта"
                        onClick={() =>
                          startTransition(() => removeProjectMemberAction(projectId, m.id))
                        }
                        className="text-muted transition hover:text-red-400 disabled:opacity-50"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )
                  )}
                </li>
              ))}
            </ul>

            {canManage && candidates.length > 0 && (
              <div className="mt-4 flex gap-2 border-t border-edge pt-4">
                <select
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm outline-none transition focus:border-accent"
                >
                  <option value="">Выберите пользователя…</option>
                  {candidates.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!selected || pending}
                  onClick={add}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold transition hover:bg-accent-hover disabled:opacity-50"
                >
                  Добавить
                </button>
              </div>
            )}
            {canManage && candidates.length === 0 && (
              <p className="mt-4 border-t border-edge pt-4 text-xs text-muted">
                Все активные пользователи уже в проекте.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
