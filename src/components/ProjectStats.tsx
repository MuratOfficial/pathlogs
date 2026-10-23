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
import { Card, SectionTitle } from "@/components/ui/Card";

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
          <span className="w-28 shrink-0 text-right text-xs font-medium">
            {r.hint ?? r.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function StatTile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <Card className="text-center">
      <p className="text-2xl font-bold" style={accent ? { color: accent } : undefined}>
        {value}
      </p>
      <p className="mt-0.5 text-xs uppercase tracking-wide text-muted">{label}</p>
    </Card>
  );
}

/** Столбчатый график «создано vs закрыто» по неделям. */
function CompletionChart({
  data,
}: {
  data: { label: string; created: number; closed: number }[];
}) {
  const max = Math.max(...data.flatMap((d) => [d.created, d.closed]), 1);
  return (
    <div>
      <div className="flex h-40 items-end gap-2">
        {data.map((d, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-32 w-full items-end justify-center gap-0.5">
              <div
                className="w-1/2 rounded-t bg-accent/70"
                style={{ height: `${(d.created / max) * 100}%` }}
                data-tip={`Создано: ${d.created}`}
              />
              <div
                className="w-1/2 rounded-t bg-success/70"
                style={{ height: `${(d.closed / max) * 100}%` }}
                data-tip={`Закрыто: ${d.closed}`}
              />
            </div>
            <span className="text-[10px] text-muted">{d.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-accent/70" /> создано
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-success/70" /> закрыто
        </span>
      </div>
    </div>
  );
}

export function ProjectStats({
  tasks,
  hoursByUser,
  completion,
}: {
  tasks: TaskDTO[];
  hoursByUser: { name: string; hours: number }[];
  completion: { label: string; created: number; closed: number }[];
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
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatTile label="Всего задач" value={String(tasks.length)} />
        <StatTile label="Открыто" value={String(open.length)} />
        <StatTile label="Завершено" value={`${donePct}%`} accent="var(--success-text)" />
        <StatTile
          label="Просрочено"
          value={String(overdue.length)}
          accent={overdue.length ? "var(--danger-text)" : undefined}
        />
        <StatTile label="Потрачено" value={formatHours(spent)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card as="section">
          <SectionTitle className="mb-4">
            По статусам
          </SectionTitle>
          <BarList
            rows={(Object.keys(STATUS_LABELS) as TaskStatus[])
              .filter((s) => byStatus.get(s))
              .map((s) => ({
                label: STATUS_LABELS[s],
                value: byStatus.get(s)!,
                color: STATUS_COLORS[s],
              }))}
          />
        </Card>

        <Card as="section">
          <SectionTitle className="mb-4">
            По типам
          </SectionTitle>
          <BarList
            rows={(Object.keys(TYPE_LABELS) as TaskType[])
              .filter((t) => byType.get(t))
              .map((t) => ({
                label: TYPE_LABELS[t],
                value: byType.get(t)!,
                color: TYPE_COLORS[t],
              }))}
          />
        </Card>

        <Card as="section">
          <SectionTitle className="mb-4">
            По приоритетам
          </SectionTitle>
          <BarList
            rows={(Object.keys(PRIORITY_LABELS) as Priority[])
              .filter((p) => byPriority.get(p))
              .map((p) => ({
                label: PRIORITY_LABELS[p],
                value: byPriority.get(p)!,
                color: PRIORITY_COLORS[p],
              }))}
          />
        </Card>
      </div>

      <Card as="section">
        <SectionTitle className="mb-4">
          Динамика по неделям
        </SectionTitle>
        <CompletionChart data={completion} />
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card as="section">
          <SectionTitle className="mb-1">
            Оценка vs факт
          </SectionTitle>
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
                      <span className={`shrink-0 ${over ? "font-semibold text-danger-text" : "text-muted"}`}>
                        {formatHours(t.spentHours)} / {formatHours(t.estimateHours!)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className={`h-full rounded-full ${over ? "bg-danger" : "bg-success"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card as="section">
          <SectionTitle className="mb-4">
            Часы по сотрудникам
          </SectionTitle>
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
        </Card>
      </div>
    </div>
  );
}
