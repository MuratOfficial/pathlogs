"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { closeSprintAction, createSprintAction, deleteSprintAction, setTasksSprintAction } from "@/lib/actions/sprints";
import { buildBurndown, sprintProgress, type SprintTask } from "@/lib/sprint";
import { STATUS_COLORS, STATUS_LABELS, formatDate, formatHours } from "@/lib/labels";
import type { TaskDTO } from "@/lib/types";
import { ConfirmDialog } from "./ConfirmDialog";

export interface SprintDTO {
  id: string;
  name: string;
  goal: string | null;
  startsAt: string;
  endsAt: string;
  closedAt: string | null;
}

const W = 640;
const H = 200;
const PAD = { left: 40, right: 12, top: 12, bottom: 24 };

/** Линия сгорания: факт против идеальной прямой. */
function Burndown({ tasks, sprint }: { tasks: SprintTask[]; sprint: SprintDTO }) {
  const points = buildBurndown(tasks, sprint.startsAt, sprint.endsAt);
  const max = Math.max(1, ...points.map((p) => p.ideal), ...points.map((p) => p.remaining ?? 0));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;

  const factPoints = points
    .map((p, i) => (p.remaining == null ? null : `${x(i)},${y(p.remaining)}`))
    .filter(Boolean)
    .join(" ");
  const idealPoints = points.map((p, i) => `${x(i)},${y(p.ideal)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="График сгорания спринта">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(max * f)}
            y2={y(max * f)}
            stroke="var(--color-edge)"
            strokeDasharray="3 4"
          />
          <text x={4} y={y(max * f) + 4} fill="var(--color-muted)" fontSize="10">
            {Math.round(max * f)}
          </text>
        </g>
      ))}
      <polyline points={idealPoints} fill="none" stroke="var(--color-muted)" strokeWidth="1.5" strokeDasharray="5 4" />
      {factPoints && (
        <polyline points={factPoints} fill="none" stroke="var(--color-accent)" strokeWidth="2.5" />
      )}
      {points.map((p, i) =>
        p.remaining == null ? null : (
          <circle key={p.date} cx={x(i)} cy={y(p.remaining)} r="3" fill="var(--color-accent)" />
        )
      )}
      {points.map((p, i) =>
        i === 0 || i === points.length - 1 ? (
          <text key={p.date} x={x(i)} y={H - 6} fill="var(--color-muted)" fontSize="10" textAnchor={i === 0 ? "start" : "end"}>
            {p.date.slice(5)}
          </text>
        ) : null
      )}
    </svg>
  );
}

export function SprintPanel({
  projectId,
  projectKey,
  sprints,
  tasks,
  canManage,
}: {
  projectId: string;
  projectKey: string;
  sprints: SprintDTO[];
  tasks: (TaskDTO & { sprintId: string | null; closedAt: string | null })[];
  canManage: boolean;
}) {
  const [state, formAction, creating] = useActionState(createSprintAction, undefined);
  const [showForm, setShowForm] = useState(false);
  const [toDelete, setToDelete] = useState<SprintDTO | null>(null);
  const [picking, setPicking] = useState(false);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const active = sprints.find((s) => !s.closedAt) ?? sprints[0] ?? null;
  const sprintTasks = active ? tasks.filter((t) => t.sprintId === active.id) : [];
  const backlog = tasks.filter((t) => t.sprintId === null);
  const progress = active ? sprintProgress(sprintTasks, active.endsAt) : null;

  function addChosen() {
    if (!active || chosen.size === 0) return;
    startTransition(async () => {
      await setTasksSprintAction([...chosen], active.id);
      setChosen(new Set());
      setPicking(false);
    });
  }

  return (
    <div className="h-full overflow-y-auto pb-4">
      <div className="mx-auto max-w-400 space-y-4">
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold transition hover:bg-accent-hover"
            >
              {showForm ? "Отмена" : "+ Новый спринт"}
            </button>
            {active && !active.closedAt && (
              <button
                type="button"
                onClick={() => setPicking((v) => !v)}
                className="rounded-lg border border-edge px-4 py-2 text-sm text-muted transition hover:bg-surface-2 hover:text-foreground"
              >
                {picking ? "Закрыть список" : `Добавить задачи (${backlog.length} свободных)`}
              </button>
            )}
          </div>
        )}

        {showForm && (
          <form action={formAction} className="grid gap-3 rounded-2xl border border-edge bg-surface p-4 sm:grid-cols-2">
            <input type="hidden" name="projectId" value={projectId} />
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs text-muted">Название</span>
              <input name="name" required placeholder="Спринт 12" className="w-full rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">Начало</span>
              <input type="date" name="startsAt" required className="w-full rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">Окончание</span>
              <input type="date" name="endsAt" required className="w-full rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent" />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs text-muted">Цель спринта (необязательно)</span>
              <input name="goal" placeholder="Что должно быть готово к концу" className="w-full rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent" />
            </label>
            {state?.error && <p className="text-sm text-red-400 sm:col-span-2">{state.error}</p>}
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold transition hover:bg-accent-hover disabled:opacity-50 sm:col-span-2"
            >
              {creating ? "Создаём…" : "Создать спринт"}
            </button>
          </form>
        )}

        {!active && (
          <div className="rounded-2xl border border-dashed border-edge p-12 text-center text-sm text-muted">
            Спринтов пока нет. Создайте первый — и задачи можно будет собирать в итерации,
            а прогресс смотреть на графике сгорания.
          </div>
        )}

        {active && progress && (
          <>
            <div className="rounded-2xl border border-edge bg-surface p-5">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-bold">{active.name}</h2>
                {active.closedAt ? (
                  <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-muted">закрыт</span>
                ) : progress.overdue ? (
                  <span className="rounded-full bg-red-500/20 px-2.5 py-0.5 text-xs font-semibold text-red-400">
                    просрочен
                  </span>
                ) : (
                  <span className="rounded-full bg-accent/20 px-2.5 py-0.5 text-xs font-semibold text-accent-hover">
                    осталось дней: {Math.max(0, progress.daysLeft)}
                  </span>
                )}
                <span className="text-xs text-muted">
                  {formatDate(active.startsAt)} — {formatDate(active.endsAt)}
                </span>
                {canManage && (
                  <span className="ml-auto flex gap-2">
                    <button
                      type="button"
                      onClick={() => startTransition(() => closeSprintAction(active.id))}
                      className="rounded-lg border border-edge px-3 py-1.5 text-xs text-muted transition hover:bg-surface-2 hover:text-foreground"
                    >
                      {active.closedAt ? "Открыть заново" : "Закрыть спринт"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setToDelete(active)}
                      className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-400 transition hover:bg-red-500/10"
                    >
                      Удалить
                    </button>
                  </span>
                )}
              </div>

              {active.goal && <p className="mb-3 text-sm text-muted">Цель: {active.goal}</p>}

              <div className="mb-4 flex flex-wrap gap-6 text-sm">
                <span>
                  Выполнено:{" "}
                  <b>
                    {progress.unit === "часы" ? formatHours(progress.done) : progress.done}
                    {" из "}
                    {progress.unit === "часы" ? formatHours(progress.total) : progress.total}
                  </b>
                </span>
                <span className="text-muted">Задач в спринте: {sprintTasks.length}</span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${Math.round(progress.ratio * 100)}%` }}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-edge bg-surface p-5">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
                Сгорание · {progress.unit}
              </h3>
              <Burndown tasks={sprintTasks} sprint={active} />
              <p className="mt-1 text-xs text-muted">
                Пунктир — идеальное равномерное сгорание, сплошная — как идёт на самом деле.
              </p>
            </div>

            {picking && (
              <div className="rounded-2xl border border-accent/50 bg-surface p-4">
                <div className="mb-3 flex items-center gap-3">
                  <span className="text-sm font-semibold">Выбрано: {chosen.size}</span>
                  <button
                    type="button"
                    onClick={addChosen}
                    disabled={chosen.size === 0}
                    className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold transition hover:bg-accent-hover disabled:opacity-40"
                  >
                    Добавить в спринт
                  </button>
                </div>
                <div className="max-h-72 space-y-1 overflow-y-auto">
                  {backlog.map((t) => (
                    <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-2">
                      <input
                        type="checkbox"
                        checked={chosen.has(t.id)}
                        onChange={() =>
                          setChosen((prev) => {
                            const next = new Set(prev);
                            if (next.has(t.id)) next.delete(t.id);
                            else next.add(t.id);
                            return next;
                          })
                        }
                        className="h-4 w-4 accent-[var(--accent)]"
                      />
                      <span className="font-mono text-xs text-muted">
                        {projectKey}-{t.number}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
                    </label>
                  ))}
                  {backlog.length === 0 && (
                    <p className="py-6 text-center text-sm text-muted">
                      Все задачи проекта уже разобраны по спринтам.
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-edge bg-surface">
              <h3 className="border-b border-edge px-5 py-3 text-sm font-semibold uppercase tracking-wide text-muted">
                Задачи спринта
              </h3>
              <ul>
                {sprintTasks.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 border-b border-edge/60 px-5 py-2.5 last:border-0">
                    <span className="font-mono text-xs text-muted">
                      {projectKey}-{t.number}
                    </span>
                    <Link href={`/tasks/${t.id}`} className="min-w-0 flex-1 truncate text-sm hover:text-accent-hover">
                      {t.title}
                    </Link>
                    <span
                      className="rounded px-2 py-0.5 text-xs font-medium"
                      style={{ backgroundColor: STATUS_COLORS[t.status] + "26", color: STATUS_COLORS[t.status] }}
                    >
                      {STATUS_LABELS[t.status]}
                    </span>
                    {canManage && (
                      <button
                        type="button"
                        data-tip="Убрать из спринта"
                        onClick={() => startTransition(async () => { await setTasksSprintAction([t.id], null); })}
                        className="text-xs text-muted transition hover:text-red-400"
                      >
                        ✕
                      </button>
                    )}
                  </li>
                ))}
                {sprintTasks.length === 0 && (
                  <li className="px-5 py-8 text-center text-sm text-muted">
                    В спринте пока нет задач.
                  </li>
                )}
              </ul>
            </div>
          </>
        )}

        {sprints.length > 1 && (
          <div className="rounded-2xl border border-edge bg-surface p-4">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
              Прошлые спринты
            </h3>
            <ul className="space-y-1 text-sm">
              {sprints
                .filter((s) => s.id !== active?.id)
                .map((s) => {
                  const st = tasks.filter((t) => t.sprintId === s.id);
                  const p = sprintProgress(st, s.endsAt);
                  return (
                    <li key={s.id} className="flex items-center gap-3">
                      <span className="font-medium">{s.name}</span>
                      <span className="text-xs text-muted">
                        {formatDate(s.startsAt)} — {formatDate(s.endsAt)}
                      </span>
                      <span className="ml-auto text-xs text-muted">
                        {Math.round(p.ratio * 100)}% · {st.length} задач
                      </span>
                    </li>
                  );
                })}
            </ul>
          </div>
        )}

        <ConfirmDialog
          open={toDelete !== null}
          title={`Удалить спринт «${toDelete?.name ?? ""}»?`}
          message="Задачи не удалятся — они просто выйдут из спринта и вернутся в общий список."
          confirmLabel="Удалить спринт"
          onConfirm={() => {
            const id = toDelete!.id;
            setToDelete(null);
            startTransition(() => deleteSprintAction(id));
          }}
          onCancel={() => setToDelete(null)}
        />
      </div>
    </div>
  );
}
