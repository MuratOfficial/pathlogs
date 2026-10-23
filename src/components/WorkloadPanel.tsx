import { formatHours, initials } from "@/lib/labels";
import type { WorkloadRow } from "@/lib/workload";
import { DragScroll, PageHint } from "@toimetdev/pathlogs-core";
import { Card } from "@/components/ui/Card";

/**
 * Кто чем занят: открытые задачи, часы и просрочки по каждому участнику.
 * Полоса под именем — доля от самого загруженного, чтобы перекос был виден
 * без сравнения чисел глазами.
 */
export function WorkloadPanel({
  rows,
  unassigned,
}: {
  rows: WorkloadRow[];
  unassigned: number;
}) {
  const maxOpen = Math.max(1, ...rows.map((r) => r.openTasks));
  const totals = rows.reduce(
    (acc, r) => ({
      open: acc.open + r.openTasks,
      overdue: acc.overdue + r.overdue,
      spent: acc.spent + r.spentHours,
    }),
    { open: 0, overdue: 0, spent: 0 }
  );

  return (
    <div className="h-full overflow-y-auto pb-4">
      <div className="mx-auto max-w-400 space-y-4">
        <PageHint>
          Часы задачи с несколькими исполнителями делятся между ними поровну — сумма
          по команде совпадает с реальной.
        </PageHint>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "Открытых задач", value: String(totals.open) },
            { label: "Просрочено", value: String(totals.overdue), alarm: totals.overdue > 0 },
            { label: "Списано часов", value: formatHours(totals.spent) },
          ].map((c) => (
            <Card key={c.label}>
              <div className="text-xs text-muted">{c.label}</div>
              <div
                className={`mt-1 text-2xl font-bold ${c.alarm ? "text-danger-text" : ""}`}
              >
                {c.value}
              </div>
            </Card>
          ))}
        </div>

        {unassigned > 0 && (
          <div className="rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
            <b>{unassigned}</b> открытых задач никому не назначены — в сводке ниже их нет.
          </div>
        )}

        <Card as={DragScroll} flush className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-surface-2/60 text-left text-xs text-muted">
              <tr>
                <th className="px-5 py-3 font-medium">Участник</th>
                <th className="px-5 py-3 font-medium">Открыто</th>
                <th className="px-5 py-3 font-medium">В работе</th>
                <th className="px-5 py-3 font-medium">Просрочено</th>
                <th className="px-5 py-3 font-medium">Оценка (открытые)</th>
                <th className="px-5 py-3 font-medium">Списано</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.userId} className="border-t border-edge/60">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/25 text-[10px] font-bold text-accent-hover">
                        {initials(r.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{r.name}</div>
                        <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-surface-2">
                          <div
                            className="h-full rounded-full bg-accent"
                            style={{ width: `${(r.openTasks / maxOpen) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 font-semibold tabular-nums">{r.openTasks}</td>
                  <td className="px-5 py-3 tabular-nums">{r.inProgress}</td>
                  <td
                    className={`px-5 py-3 tabular-nums ${r.overdue > 0 ? "font-semibold text-danger-text" : "text-muted"}`}
                  >
                    {r.overdue || "—"}
                  </td>
                  <td className="px-5 py-3 tabular-nums text-muted">
                    {r.openEstimate > 0 ? formatHours(r.openEstimate) : "—"}
                  </td>
                  <td className="px-5 py-3 tabular-nums text-muted">
                    {r.spentHours > 0 ? formatHours(r.spentHours) : "—"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-muted">
                    В проекте пока нет участников с задачами.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
