import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/auth";
import {
  STATUS_COLORS,
  STATUS_LABELS,
  formatDate,
  formatHours,
} from "@/lib/labels";
import { TypeBadge, PriorityBadge } from "@/components/TaskBadges";
import type { TaskStatus } from "@prisma/client";

const ACTIVE_ORDER: TaskStatus[] = ["IN_PROGRESS", "REVIEW", "TODO"];

/** Все мои задачи по всем проектам, сгруппированные по статусу. */
export default async function MyTasksPage() {
  const user = await requireUser();

  const tasks = await prisma.task.findMany({
    where: {
      assignees: { some: { id: user.id } },
      status: { in: ["TODO", "IN_PROGRESS", "REVIEW"] },
      project: { status: "ACTIVE" },
    },
    include: {
      project: { select: { id: true, key: true, name: true } },
      timeEntries: { select: { hours: true } },
      checklist: { select: { done: true } },
    },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
  });

  const now = new Date();
  const overdue = tasks.filter(
    (t) => t.dueDate && t.dueDate < now
  ).length;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Мои задачи</h1>
        <div className="flex items-center gap-4 text-xs text-muted">
          <span>
            Открыто: <b className="text-foreground">{tasks.length}</b>
          </span>
          {overdue > 0 && (
            <span className="rounded-md bg-red-500/15 px-2 py-1 font-semibold text-red-400">
              Просрочено: {overdue}
            </span>
          )}
        </div>
      </div>

      {tasks.length === 0 && (
        <p className="rounded-2xl border border-edge bg-surface p-6 text-sm text-muted">
          На вас не назначено открытых задач. Отличный момент взять что-то с доски.
        </p>
      )}

      {ACTIVE_ORDER.map((status) => {
        const group = tasks.filter((t) => t.status === status);
        if (group.length === 0) return null;
        return (
          <section key={status} className="mb-6">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: STATUS_COLORS[status] }}
              />
              {STATUS_LABELS[status]} ({group.length})
            </h2>
            <ul className="space-y-2">
              {group.map((t) => {
                const spent = t.timeEntries.reduce((s, e) => s + e.hours, 0);
                const checkDone = t.checklist.filter((i) => i.done).length;
                const isOverdue = t.dueDate && t.dueDate < now;
                return (
                  <li key={t.id}>
                    <Link
                      href={`/tasks/${t.id}`}
                      className="flex items-center gap-3 rounded-xl border border-edge bg-surface px-4 py-3 transition hover:border-accent/50"
                    >
                      <span className="font-mono text-xs text-muted">
                        {t.project.key}-{t.number}
                      </span>
                      <TypeBadge type={t.type} />
                      <PriorityBadge priority={t.priority} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {t.title}
                      </span>
                      {t.checklist.length > 0 && (
                        <span className="shrink-0 text-xs text-muted">
                          ☑ {checkDone}/{t.checklist.length}
                        </span>
                      )}
                      {(spent > 0 || t.estimateHours) && (
                        <span className="shrink-0 text-xs text-muted">
                          {formatHours(spent)}
                          {t.estimateHours ? ` / ${formatHours(t.estimateHours)}` : ""}
                        </span>
                      )}
                      {t.dueDate && (
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${
                            isOverdue
                              ? "bg-red-500/15 font-semibold text-red-400"
                              : "text-muted"
                          }`}
                        >
                          {formatDate(t.dueDate)}
                        </span>
                      )}
                      <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">
                        {t.project.name}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
