"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TaskDTO, LinkDTO } from "@/lib/types";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/labels";
import { updateTaskFieldsAction } from "@/lib/actions/tasks";
import { TypeBadge } from "./TaskBadges";

const DAY = 86400000;
const ROW_H = 37; // фиксированная высота строки — для точного наложения SVG-связей
const CRIT = "#f59e0b"; // янтарный — критический путь

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type DragMode = "move" | "start" | "end";
interface DragState {
  taskId: string;
  mode: DragMode;
  startX: number;
  origFrom: number;
  origTo: number;
  delta: number;
}

/** Диаграмма Ганта: задачи с датами как полосы. Полосу можно перетаскивать
 *  (сдвиг дат) и тянуть за края (начало/срок) — изменения сохраняются. */
export function GanttChart({
  tasks,
  projectKey,
  links = [],
}: {
  tasks: TaskDTO[];
  projectKey: string;
  links?: LinkDTO[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const moved = useRef(false);

  const dated = tasks
    .map((t) => {
      const s = t.startDate ? startOfDay(new Date(t.startDate)) : null;
      const e = t.dueDate ? startOfDay(new Date(t.dueDate)) : null;
      const from = s ?? e;
      const to = e ?? s;
      return from && to ? { task: t, from, to: to >= from ? to : from } : null;
    })
    .filter((x): x is { task: TaskDTO; from: Date; to: Date } => x !== null)
    .sort((a, b) => a.from.getTime() - b.from.getTime());

  if (dated.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-edge text-sm text-muted">
        Нет задач с датами начала или срока. Проставьте даты — они появятся на диаграмме.
      </div>
    );
  }

  const minDate = startOfDay(new Date(Math.min(...dated.map((d) => d.from.getTime()))));
  const maxDate = startOfDay(new Date(Math.max(...dated.map((d) => d.to.getTime()))));
  const pad = 2;
  const scaleStart = new Date(minDate.getTime() - pad * DAY);
  const totalDays = Math.round((maxDate.getTime() - scaleStart.getTime()) / DAY) + pad + 2;
  const dayW = totalDays > 90 ? 12 : totalDays > 45 ? 20 : 32;
  const today = startOfDay(new Date());

  const months: { label: string; dayOffset: number }[] = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(scaleStart.getTime() + i * DAY);
    if (d.getDate() === 1 || i === 0) {
      months.push({
        label: d.toLocaleDateString("ru-RU", { month: "short", year: "2-digit" }),
        dayOffset: i,
      });
    }
  }

  const labelW = 260;
  const chartW = totalDays * dayW;
  const todayOffset = Math.round((today.getTime() - scaleStart.getTime()) / DAY);

  // ── Раскладка строк + зависимости (BLOCKS) ───────────────────────
  const layout = new Map<string, { idx: number; offset: number; span: number }>();
  dated.forEach((row, idx) => {
    const offset = Math.round((row.from.getTime() - scaleStart.getTime()) / DAY);
    const span = Math.round((row.to.getTime() - row.from.getTime()) / DAY) + 1;
    layout.set(row.task.id, { idx, offset, span });
  });
  const datedIds = new Set(layout.keys());
  const durOf = (id: string) => layout.get(id)!.span;

  // Рёбра «from блокирует to» между задачами с датами
  const edges = links.filter(
    (l) =>
      l.type === "BLOCKS" &&
      datedIds.has(l.fromId) &&
      datedIds.has(l.toId) &&
      l.fromId !== l.toId
  );

  // Критический путь = длиннейшая по длительности цепочка зависимостей
  const adj = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  datedIds.forEach((id) => indeg.set(id, 0));
  edges.forEach((e) => {
    (adj.get(e.fromId) ?? adj.set(e.fromId, []).get(e.fromId)!).push(e.toId);
    indeg.set(e.toId, (indeg.get(e.toId) ?? 0) + 1);
  });
  const order: string[] = [];
  const q = [...datedIds].filter((id) => indeg.get(id) === 0);
  const indegLeft = new Map(indeg);
  while (q.length) {
    const n = q.shift()!;
    order.push(n);
    for (const m of adj.get(n) ?? []) {
      indegLeft.set(m, indegLeft.get(m)! - 1);
      if (indegLeft.get(m) === 0) q.push(m);
    }
  }
  const critSet = new Set<string>();
  const critPrev = new Map<string, string | null>();
  if (edges.length && order.length === datedIds.size) {
    const dist = new Map<string, number>();
    datedIds.forEach((id) => {
      dist.set(id, durOf(id));
      critPrev.set(id, null);
    });
    for (const n of order) {
      for (const m of adj.get(n) ?? []) {
        const cand = dist.get(n)! + durOf(m);
        if (cand > dist.get(m)!) {
          dist.set(m, cand);
          critPrev.set(m, n);
        }
      }
    }
    let end: string | null = null;
    let best = -1;
    datedIds.forEach((id) => {
      if (dist.get(id)! > best) {
        best = dist.get(id)!;
        end = id;
      }
    });
    const path: string[] = [];
    let cur: string | null = end;
    while (cur) {
      path.push(cur);
      cur = critPrev.get(cur) ?? null;
    }
    if (path.length > 1) path.forEach((id) => critSet.add(id));
  }
  const critIsEdge = (from: string, to: string) =>
    critSet.has(from) && critSet.has(to) && critPrev.get(to) === from;

  // Заблокированные: задача с датами, которую блокирует незавершённый блокер
  const blockedBy = new Map<string, string[]>();
  for (const l of links) {
    if (l.type !== "BLOCKS" || !datedIds.has(l.toId)) continue;
    const blocker = tasks.find((t) => t.id === l.fromId);
    if (blocker && blocker.status !== "DONE" && blocker.status !== "CLOSED") {
      const arr = blockedBy.get(l.toId) ?? [];
      arr.push(`${projectKey}-${blocker.number}`);
      blockedBy.set(l.toId, arr);
    }
  }
  const chartH = dated.length * ROW_H;

  // ── Перетаскивание ────────────────────────────────────────────────
  function onPointerDown(
    e: React.PointerEvent,
    mode: DragMode,
    from: Date,
    to: Date,
    taskId: string
  ) {
    e.preventDefault();
    e.stopPropagation();
    moved.current = false;
    const st: DragState = {
      taskId,
      mode,
      startX: e.clientX,
      origFrom: from.getTime(),
      origTo: to.getTime(),
      delta: 0,
    };
    dragRef.current = st;
    setDrag(st);

    function onMove(ev: PointerEvent) {
      const cur = dragRef.current;
      if (!cur) return;
      const delta = Math.round((ev.clientX - cur.startX) / dayW);
      if (delta !== cur.delta) {
        if (delta !== 0) moved.current = true;
        const next = { ...cur, delta };
        dragRef.current = next;
        setDrag(next);
      }
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const cur = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (!cur || cur.delta === 0) return;
      const { from: nf, to: nt } = applied(cur);
      startTransition(() =>
        updateTaskFieldsAction(cur.taskId, {
          startDate: ymd(new Date(nf)),
          dueDate: ymd(new Date(nt)),
        })
      );
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  /** Применяет дельту перетаскивания к датам в зависимости от режима. */
  function applied(d: DragState): { from: number; to: number } {
    const shift = d.delta * DAY;
    if (d.mode === "move") return { from: d.origFrom + shift, to: d.origTo + shift };
    if (d.mode === "start")
      return { from: Math.min(d.origTo, d.origFrom + shift), to: d.origTo };
    return { from: d.origFrom, to: Math.max(d.origFrom, d.origTo + shift) };
  }

  return (
    <div className="flex h-full flex-col">
      {(critSet.size > 0 || blockedBy.size > 0) && (
        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          {critSet.size > 0 && (
            <span className="flex items-center gap-1.5">
              <span style={{ color: CRIT }}>⚡</span> Критический путь:{" "}
              <b className="text-foreground">{critSet.size}</b> задач
            </span>
          )}
          {blockedBy.size > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="text-red-400">🔒</span> Заблокировано:{" "}
              <b className="text-foreground">{blockedBy.size}</b>
            </span>
          )}
          {edges.length > 0 && <span>Связей BLOCKS: {edges.length}</span>}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-edge bg-surface">
        <div style={{ width: labelW + chartW, minWidth: "100%" }}>
        <div className="sticky top-0 z-10 flex border-b border-edge bg-surface">
          <div
            className="shrink-0 border-r border-edge px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted"
            style={{ width: labelW }}
          >
            Задача · тяните полосу и края
          </div>
          <div className="relative" style={{ width: chartW, height: 32 }}>
            {months.map((m, i) => (
              <span
                key={i}
                className="absolute top-2 text-xs text-muted"
                style={{ left: m.dayOffset * dayW + 4 }}
              >
                {m.label}
              </span>
            ))}
          </div>
        </div>

        <div className="relative">
          {todayOffset >= 0 && todayOffset <= totalDays && (
            <div
              className="pointer-events-none absolute top-0 bottom-0 z-0 w-px bg-accent/50"
              style={{ left: labelW + todayOffset * dayW + dayW / 2 }}
              data-tip="Сегодня"
            />
          )}

          {dated.map((row) => {
            const { task } = row;
            const isDragging = drag?.taskId === task.id;
            const eff =
              isDragging && drag ? applied(drag) : { from: row.from.getTime(), to: row.to.getTime() };
            const from = new Date(eff.from);
            const to = new Date(eff.to);
            const offset = Math.round((eff.from - scaleStart.getTime()) / DAY);
            const span = Math.round((eff.to - eff.from) / DAY) + 1;
            const overdue =
              task.dueDate &&
              startOfDay(new Date(task.dueDate)) < today &&
              task.status !== "DONE" &&
              task.status !== "CLOSED";
            const critical = critSet.has(task.id);
            const blockers = blockedBy.get(task.id);
            return (
              <div
                key={task.id}
                className="flex items-center border-b border-edge/60 hover:bg-surface-2/40"
                style={{ height: ROW_H }}
              >
                <div
                  onClick={() => router.push(`/tasks/${task.id}`)}
                  className="flex shrink-0 cursor-pointer items-center gap-2 px-4 py-2"
                  style={{ width: labelW }}
                >
                  {critical && (
                    <span
                      className="shrink-0 text-xs"
                      style={{ color: CRIT }}
                      data-tip="На критическом пути"
                    >
                      ⚡
                    </span>
                  )}
                  <span className="font-mono text-[11px] text-muted">
                    {projectKey}-{task.number}
                  </span>
                  <TypeBadge type={task.type} />
                  <span className="min-w-0 flex-1 truncate text-sm">{task.title}</span>
                  {blockers && (
                    <span
                      className="shrink-0 text-xs text-red-400"
                      data-tip={`Заблокирована: ${blockers.join(", ")}`}
                    >
                      🔒
                    </span>
                  )}
                </div>
                <div className="relative py-2" style={{ width: chartW, height: 36 }}>
                  <div
                    onPointerDown={(e) => onPointerDown(e, "move", from, to, task.id)}
                    className="group absolute top-1/2 flex h-5 -translate-y-1/2 cursor-grab items-center rounded px-1.5 active:cursor-grabbing"
                    style={{
                      left: offset * dayW + 1,
                      width: Math.max(span * dayW - 2, dayW - 2),
                      backgroundColor: STATUS_COLORS[task.status],
                      outline: overdue
                        ? "1.5px solid #ef4444"
                        : critical
                          ? `1.5px solid ${CRIT}`
                          : undefined,
                      boxShadow: isDragging
                        ? "0 0 0 2px var(--color-accent)"
                        : critical
                          ? `0 0 0 1px ${CRIT}, 0 0 10px -2px ${CRIT}`
                          : undefined,
                    }}
                    data-tip={`${STATUS_LABELS[task.status]} · ${from.toLocaleDateString("ru-RU")} — ${to.toLocaleDateString("ru-RU")}`}
                  >
                    {/* левый край — двигает начало */}
                    <span
                      onPointerDown={(e) => onPointerDown(e, "start", from, to, task.id)}
                      className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize rounded-l opacity-0 transition group-hover:opacity-100"
                      style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
                    />
                    {span * dayW > 48 && (
                      <span className="pointer-events-none truncate text-[10px] font-semibold text-black/70">
                        {span} дн.
                      </span>
                    )}
                    {/* правый край — двигает срок */}
                    <span
                      onPointerDown={(e) => onPointerDown(e, "end", from, to, task.id)}
                      className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize rounded-r opacity-0 transition group-hover:opacity-100"
                      style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {edges.length > 0 && (
            <svg
              className="pointer-events-none absolute left-0 top-0 z-10 overflow-visible"
              width={labelW + chartW}
              height={chartH}
            >
              <defs>
                <marker id="gantt-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="var(--color-muted)" />
                </marker>
                <marker id="gantt-arrow-crit" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill={CRIT} />
                </marker>
              </defs>
              {edges.map((e, i) => {
                const a = layout.get(e.fromId)!;
                const b = layout.get(e.toId)!;
                const x1 = labelW + (a.offset + a.span) * dayW;
                const y1 = a.idx * ROW_H + ROW_H / 2;
                const x2 = labelW + b.offset * dayW;
                const y2 = b.idx * ROW_H + ROW_H / 2;
                const crit = critIsEdge(e.fromId, e.toId);
                const dx = Math.max(16, Math.abs(x2 - x1) / 2);
                return (
                  <path
                    key={i}
                    d={`M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2 - 6} ${y2}`}
                    fill="none"
                    stroke={crit ? CRIT : "var(--color-muted)"}
                    strokeWidth={crit ? 2 : 1.25}
                    strokeOpacity={crit ? 0.9 : 0.5}
                    markerEnd={`url(#${crit ? "gantt-arrow-crit" : "gantt-arrow"})`}
                  />
                );
              })}
            </svg>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
