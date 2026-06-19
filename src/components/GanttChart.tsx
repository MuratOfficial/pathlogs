"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TaskDTO } from "@/lib/types";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/labels";
import { updateTaskFieldsAction } from "@/lib/actions/tasks";
import { TypeBadge } from "./TaskBadges";

const DAY = 86400000;

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
}: {
  tasks: TaskDTO[];
  projectKey: string;
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
    <div className="h-full overflow-auto rounded-2xl border border-edge bg-surface">
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
            return (
              <div
                key={task.id}
                className="flex items-center border-b border-edge/60 hover:bg-surface-2/40"
              >
                <div
                  onClick={() => router.push(`/tasks/${task.id}`)}
                  className="flex shrink-0 cursor-pointer items-center gap-2 px-4 py-2"
                  style={{ width: labelW }}
                >
                  <span className="font-mono text-[11px] text-muted">
                    {projectKey}-{task.number}
                  </span>
                  <TypeBadge type={task.type} />
                  <span className="min-w-0 flex-1 truncate text-sm">{task.title}</span>
                </div>
                <div className="relative py-2" style={{ width: chartW, height: 36 }}>
                  <div
                    onPointerDown={(e) => onPointerDown(e, "move", from, to, task.id)}
                    className="group absolute top-1/2 flex h-5 -translate-y-1/2 cursor-grab items-center rounded px-1.5 active:cursor-grabbing"
                    style={{
                      left: offset * dayW + 1,
                      width: Math.max(span * dayW - 2, dayW - 2),
                      backgroundColor: STATUS_COLORS[task.status],
                      outline: overdue ? "1.5px solid #ef4444" : undefined,
                      boxShadow: isDragging ? "0 0 0 2px var(--color-accent)" : undefined,
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
        </div>
      </div>
    </div>
  );
}
