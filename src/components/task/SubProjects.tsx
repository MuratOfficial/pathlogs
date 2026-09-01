"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  attachSubProjectAction,
  detachSubProjectAction,
} from "@/lib/actions/subprojects";
import type { SubProjectDTO } from "@/lib/subprojects";

/**
 * Проекты, привязанные к задаче как подзадачи: крупную ветку работы удобнее
 * вести отдельным проектом, но видеть её прогресс прямо в родительской карточке.
 */
export function SubProjects({
  taskId,
  projects,
  attachable,
}: {
  taskId: string;
  projects: SubProjectDTO[];
  /** Активные проекты, доступные пользователю и ещё не привязанные. */
  attachable: { id: string; key: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [picked, setPicked] = useState("");
  const [error, setError] = useState<string | null>(null);

  function attach() {
    if (!picked) return;
    const projectId = picked;
    setPicked("");
    setError(null);
    startTransition(async () => {
      const res = await attachSubProjectAction(taskId, projectId);
      if (res.error) setError(res.error);
    });
  }

  return (
    <div className={pending ? "opacity-60" : ""}>
      {projects.length > 0 && (
        <ul className="mb-3 space-y-2">
          {projects.map((p) => {
            const pct = p.taskCount ? Math.round((p.doneCount / p.taskCount) * 100) : 0;
            return (
              <li
                key={p.id}
                className="relative rounded-xl border border-edge bg-surface-2/50 px-4 py-3 transition hover:border-accent/50"
              >
                <Link href={`/projects/${p.id}`} className="absolute inset-0 z-0" />
                <div className="pointer-events-none relative z-10">
                  <div className="flex items-center gap-2.5">
                    <span className="rounded-md bg-accent/15 px-2 py-0.5 font-mono text-[10px] font-bold text-accent-hover">
                      {p.key}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {p.name}
                    </span>
                    {p.archived && (
                      <span className="rounded-md bg-surface px-2 py-0.5 text-[10px] text-muted">
                        в архиве
                      </span>
                    )}
                    <span className="text-[11px] tabular-nums text-muted">
                      {p.doneCount}/{p.taskCount}
                    </span>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        startTransition(() => detachSubProjectAction(taskId, p.id))
                      }
                      data-tip="Отвязать проект"
                      aria-label={"Отвязать проект " + p.name}
                      className="pointer-events-auto rounded-lg px-1.5 py-0.5 text-xs text-muted transition hover:bg-red-500/10 hover:text-red-400"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface">
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <select
          value={picked}
          onChange={(e) => setPicked(e.target.value)}
          disabled={attachable.length === 0 || pending}
          aria-label="Проект для привязки как подзадача"
          className="min-w-0 flex-1 rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-50"
        >
          <option value="">
            {attachable.length
              ? "— Привязать проект как подзадачу —"
              : "Доступных проектов нет"}
          </option>
          {attachable.map((p) => (
            <option key={p.id} value={p.id}>
              {p.key} · {p.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={attach}
          disabled={!picked || pending}
          className="rounded-lg border border-edge px-3 py-2 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-foreground disabled:opacity-50"
        >
          Привязать
        </button>
      </div>

      {error && (
        <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}
