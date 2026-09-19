import { Sparkline } from "@toimetdev/pathlogs-core";
import type { TaskStatus } from "@prisma/client";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/labels";
import { formatDuration, type FlowSummary, type FlowWeek } from "@/lib/flow";

/**
 * Метрики потока: сколько времени задача реально идёт и где стоит.
 *
 * Считается по журналу переходов статуса, который проект вёл всё это время,
 * но никто, кроме ленты одной задачи, не читал. Ничего вводить руками не надо
 * — цифры появляются сами, как только на доске двигают карточки.
 */

function Metric({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-edge bg-surface p-[var(--app-card-p)]">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold" style={accent ? { color: accent } : undefined}>
        {value}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{hint}</p>
    </div>
  );
}

export function FlowPanel({
  summary,
  weeks,
  slowest,
}: {
  summary: FlowSummary;
  weeks: FlowWeek[];
  slowest: { id: string; key: string; title: string; hours: number }[];
}) {
  const throughput = weeks.map((w) => w.done);
  // Недели без завершённых задач медианы не имеют. Для линии тренда дырку
  // приходится чем-то закрыть: берём последнее известное значение, чтобы
  // линия не падала в ноль там, где просто нечего было мерить.
  const cycleLine: number[] = [];
  for (const week of weeks) {
    cycleLine.push(week.medianCycleHours ?? cycleLine[cycleLine.length - 1] ?? 0);
  }
  const hasCycleData = weeks.some((w) => w.medianCycleHours !== null);

  const waiting = (Object.keys(STATUS_LABELS) as TaskStatus[])
    .filter((s) => summary.waitingHours[s] !== undefined)
    .map((s) => ({ status: s, hours: summary.waitingHours[s]! }))
    .sort((a, b) => b.hours - a.hours);
  const waitingMax = Math.max(...waiting.map((w) => w.hours), 1);

  if (summary.measured === 0 && throughput.every((n) => n === 0)) {
    return (
      <section className="rounded-2xl border border-edge bg-surface p-[var(--app-card-p)]">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Время работы
        </h2>
        <p className="mt-2 text-sm text-muted">
          Пока нечего считать: метрики берутся из истории переходов на доске.
          Подвигайте карточки между колонками — через неделю здесь появится
          время цикла, разброс и пропускная способность.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          label="Время цикла"
          value={formatDuration(summary.medianCycleHours)}
          hint={
            summary.measured === 0
              ? "Ни одна задача пока не прошла путь «в работе» → «готово»"
              : `Медиана по ${summary.measured} задачам: от начала работы до готовности`
          }
        />
        <Metric
          label="Разброс"
          value={formatDuration(summary.p85CycleHours)}
          hint="85% задач укладываются в этот срок — его и стоит обещать"
          accent={
            summary.p85CycleHours !== null &&
            summary.medianCycleHours !== null &&
            summary.p85CycleHours > summary.medianCycleHours * 3
              ? "#f59e0b"
              : undefined
          }
        />
        <Metric
          label="От заявки до сдачи"
          value={formatDuration(summary.medianLeadHours)}
          hint="Медиана с момента создания — с ожиданием в очереди"
        />
        <Metric
          label="Пропускная способность"
          value={`${summary.throughputPerWeek.toFixed(1).replace(".", ",")} / нед.`}
          hint="Сколько задач в среднем завершается за неделю"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-edge bg-surface p-[var(--app-card-p)]">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
              Завершено по неделям
            </h2>
            <span className="text-xs text-muted">
              всего {throughput.reduce((a, b) => a + b, 0)}
            </span>
          </div>
          <Sparkline
            values={throughput}
            height={64}
            width={520}
            fill
            dots
            zeroBased
            color="var(--success)"
            label={`Завершено задач по неделям: ${throughput.join(", ")}`}
            className="w-full"
          />
          <div className="mt-2 flex justify-between text-[10px] text-muted">
            <span>{weeks[0]?.label}</span>
            <span>{weeks[weeks.length - 1]?.label}</span>
          </div>
        </section>

        <section className="rounded-2xl border border-edge bg-surface p-[var(--app-card-p)]">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
              Время цикла по неделям
            </h2>
            <span className="text-xs text-muted">{hasCycleData ? "медиана, часы" : ""}</span>
          </div>
          {hasCycleData ? (
            <>
              <Sparkline
                values={cycleLine}
                height={64}
                width={520}
                smooth
                extremes
                zeroBased
                color="var(--accent-3)"
                label="Медианное время цикла по неделям, часы"
                className="w-full"
              />
              <p className="mt-2 text-[11px] leading-relaxed text-muted">
                Линия вверх — задачи стали идти дольше. Смотреть её полезно
                вместе с соседней: рост обеих обычно значит, что взяли больше,
                чем тянем.
              </p>
            </>
          ) : (
            // Плоская линия на нулях выглядела бы как «цикл стабильно нулевой»
            // — это ровно противоположно правде «мерить было нечего».
            <p className="text-sm leading-relaxed text-muted">
              Мерить пока нечего: задачи закрывали, минуя статус «В работе».
              Как только карточка пройдёт всю доску, здесь появится линия.
            </p>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-edge bg-surface p-[var(--app-card-p)]">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
            Где стоят задачи
          </h2>
          <p className="mb-3 text-[11px] text-muted">
            Среднее время в статусе по незакрытым задачам
          </p>
          {waiting.length === 0 ? (
            <p className="text-sm text-muted">Открытых задач нет.</p>
          ) : (
            <div className="space-y-2">
              {waiting.map((w) => (
                <div key={w.status} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-xs text-muted">
                    {STATUS_LABELS[w.status]}
                  </span>
                  <div className="h-4 flex-1 overflow-hidden rounded bg-surface-2">
                    <div
                      className="h-full rounded"
                      style={{
                        width: `${(w.hours / waitingMax) * 100}%`,
                        backgroundColor: STATUS_COLORS[w.status],
                      }}
                    />
                  </div>
                  <span className="w-20 shrink-0 text-right text-xs font-medium">
                    {formatDuration(w.hours)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-edge bg-surface p-[var(--app-card-p)]">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
            Дольше всего в работе
          </h2>
          <p className="mb-3 text-[11px] text-muted">
            Завершённые задачи с самым долгим циклом — кандидаты на разбор
          </p>
          {slowest.length === 0 ? (
            <p className="text-sm text-muted">Пока ни одна задача не прошла цикл целиком.</p>
          ) : (
            <ul className="space-y-1.5">
              {slowest.map((t) => (
                <li key={t.id} className="flex items-center gap-3 text-sm">
                  <span className="shrink-0 font-mono text-[11px] text-muted">{t.key}</span>
                  <a
                    href={`/tasks/${t.id}`}
                    className="min-w-0 flex-1 truncate transition hover:text-accent-hover"
                  >
                    {t.title}
                  </a>
                  <span className="shrink-0 text-xs font-medium text-warning">
                    {formatDuration(t.hours)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
