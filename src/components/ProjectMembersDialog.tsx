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
        className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-2 text-sm text-muted transition hover:bg-surface-2 hover:text-foreground"
        data-tip="Участники проекта"
        aria-label="Участники проекта"
      >
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
        <span className="hidden sm:inline">Участники · </span>
        {members.length}
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
                        data-tip="Исключить из проекта"
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
