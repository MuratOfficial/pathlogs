"use client";

import { useState, useTransition } from "react";
import { Dialog } from "./Dialog";
import type { MemberDTO } from "@/lib/types";
import {
  addProjectMemberAction,
  removeProjectMemberAction,
} from "@/lib/actions/projects";
import { initials } from "@/lib/labels";
import { Icon } from "@/components/ui/Icon";

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
        <Icon name="users" className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline">Участники · </span>
        {members.length}
      </button>

      {/* Через портал в <body>: у меню «Ещё» анимация на transform, а такой
          предок становится containing block для position: fixed — окно
          сжималось до ширины выпадающей панели */}
      <Dialog open={open} onClose={() => setOpen(false)} title="Участники проекта">
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
                    className="text-muted transition hover:text-danger-text disabled:opacity-50"
                  >
                    <Icon name="close" className="h-4 w-4" />
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
      </Dialog>
    </>
  );
}
