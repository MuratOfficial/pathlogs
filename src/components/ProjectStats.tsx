import type { TaskDTO } from "@/lib/types";
import {
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  TYPE_COLORS,
  TYPE_LABELS,
  formatHours,
} from "@/lib/labels";
import type { Priority, TaskStatus, TaskType } from "@prisma/client";

function countBy<K extends string>(items: TaskDTO[], key: (t: TaskDTO) => K) {
  const map = new Map<K, number>();
  for (const t of items) map.set(key(t), (map.get(key(t)) ?? 0) + 1);
  return map;
}

/** Горизонтальный список баров: подпись, количество, полоса от максимума. */
function BarList({
  rows,
}: {
  rows: { label: string; value: number; color: string; hint?: string }[];
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3">
          <span className="w-32 shrink-0 truncate text-xs text-muted">{r.label}</span>
          <div className="h-4 flex-1 overflow-hidden rounded bg-surface-2">
            <div
              className="h-full rounded transition-all"
              style={{ width: `${(r.value / max) * 100}%`, backgroundColor: r.color }}
            />
          </div>
          <span className="w-20 shrink-0 text-right text-xs font-medium">
            {r.hint ?? r.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function Card({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-edge bg-surface p-4 text-center">
      <p className="text-2xl font-bold" style={accent ? { color: accent } : undefined}>
        {value}
      </p>
      <p className="mt-0.5 text-xs uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}

export function ProjectStats({
  tasks,
  hoursByUser,
}: {
  tasks: TaskDTO[];
  hoursByUser: { name: string; hours: number }[];
}) {
  const done = tasks.filter((t) => t.status === "DONE" || t.status === "CLOSED");
  const open = tasks.filter(
    (t) => t.status !== "DONE" && t.status !== "CLOSED" && t.status !== "ARCHIVED"
  );
  const overdue = open.filter((t) => t.dueDate && new Date(t.dueDate) < new Date());
  const estimate = tasks.reduce((s, t) => s + (t.estimateHours ?? 0), 0);
  const spent = tasks.reduce((s, t) => s + t.spentHours, 0);
  const donePct = tasks.length ? Math.round((done.length / tasks.length) * 100) : 0;

  const byStatus = countBy(tasks, (t) => t.status);
  const byType = countBy(tasks, (t) => t.type);
  const byPriority = countBy(tasks, (t) => t.priority);

  // Точность оценок: задачи с оценкой и затраченным временем
  const estimated = tasks
    .filter((t) => t.estimateHours && t.spentHours > 0)
    .sort((a, b) => b.spentHours - a.spentHours)
    .slice(0, 10);

  return (
    <div className="h-full space-y-4 overflow-y-auto pb-6 pr-1">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Card label="Всего задач" value={String(tasks.length)} />
        <Card label="Открыто" value={String(open.length)} />
        <Card label="Завершено" value={`${donePct}%`} accent="#4ade80" />
        <Card
          label="Просрочено"
          value={String(overdue.length)}
          accent={overdue.length ? "#ef4444" : undefined}
        />
        <Card label="Потрачено" value={formatHours(spent)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-edge bg-surface p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted">
            По статусам
          </h2>
          <BarList
            rows={(Object.keys(STATUS_LABELS) as TaskStatus[])
              .filter((s) => byStatus.get(s))
              .map((s) => ({
                label: STATUS_LABELS[s],
                value: byStatus.get(s)!,
                color: STATUS_COLORS[s],
              }))}
          />
        </section>

        <section className="rounded-2xl border border-edge bg-surface p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted">
            По типам
          </h2>
          <BarList
            rows={(Object.keys(TYPE_LABELS) as TaskType[])
              .filter((t) => byType.get(t))
              .map((t) => ({
                label: TYPE_LABELS[t],
                value: byType.get(t)!,
                color: TYPE_COLORS[t],
              }))}
          />
        </section>

        <section className="rounded-2xl border border-edge bg-surface p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted">
            По приоритетам
          </h2>
          <BarList
            rows={(Object.keys(PRIORITY_LABELS) as Priority[])
              .filter((p) => byPriority.get(p))
              .map((p) => ({
                label: PRIORITY_LABELS[p],
                value: byPriority.get(p)!,
                color: PRIORITY_COLORS[p],
              }))}
          />
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-edge bg-surface p-5">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
            Оценка vs факт
          </h2>
          <p className="mb-4 text-xs text-muted">
            Суммарно: {formatHours(spent)} из {formatHours(estimate)} оценённых
          </p>
          {estimated.length === 0 ? (
            <p className="text-sm text-muted">
              Нет задач с оценкой и списанным временем.
            </p>
          ) : (
            <div className="space-y-2.5">
              {estimated.map((t) => {
                const over = t.spentHours > (t.estimateHours ?? 0);
                const pct = Math.min(100, (t.spentHours / (t.estimateHours ?? 1)) * 100);
                return (
                  <div key={t.id}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                      <span className="truncate">
                        <span className="font-mono text-muted">#{t.number}</span> {t.title}
                      </span>
                      <span className={`shrink-0 ${over ? "font-semibold text-red-400" : "text-muted"}`}>
                        {formatHours(t.spentHours)} / {formatHours(t.estimateHours!)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className={`h-full rounded-full ${over ? "bg-red-500" : "bg-emerald-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-edge bg-surface p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted">
            Часы по сотрудникам
          </h2>
          {hoursByUser.length === 0 ? (
            <p className="text-sm text-muted">Время ещё не списывалось.</p>
          ) : (
            <BarList
              rows={hoursByUser.map((u) => ({
                label: u.name,
                value: u.hours,
                color: "#6366f1",
                hint: formatHours(u.hours),
              }))}
            />
          )}
        </section>
      </div>
    </div>
  );
}
