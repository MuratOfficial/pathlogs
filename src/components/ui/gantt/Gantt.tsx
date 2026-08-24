"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { useDragScroll } from "@toimetdev/pathlogs-hooks";
import {
  applyDrag,
  buildScale,
  criticalPath,
  datedRows,
  deltaDays,
  layoutBars,
  toISODate,
  type DragMode,
  type GanttDrag,
  type GanttEdge,
  type GanttItemLike,
} from "@/components/ui/gantt/ganttLayout";

/** Высота строки. Фиксированная — по ней SVG-связи ложатся точно на полосы. */
const ROW_H = 37;
/** Ширина колонки с названиями. */
const LABEL_W = 260;
/** Янтарный: критический путь. */
const CRITICAL_COLOR = "#f59e0b";

export interface GanttItem extends GanttItemLike {
  /** Цвет полосы. Без него берётся акцентный. */
  color?: string | null;
}

export interface GanttLabels {
  empty?: string;
  header?: string;
  today?: string;
  criticalPath?: string;
  links?: string;
  region?: string;
}

export interface GanttProps<I extends GanttItem> {
  items: I[];
  /** Связи «from блокирует to»: рисуются стрелками и дают критический путь. */
  edges?: GanttEdge[];
  /** Название элемента в левой колонке. */
  renderLabel: (item: I) => ReactNode;
  /**
   * Новые даты после перетаскивания. Без него полосы не двигаются —
   * диаграмма становится только для чтения.
   */
  onChangeDates?: (
    itemId: string,
    dates: { startDate: string; dueDate: string }
  ) => void | Promise<unknown>;
  onOpenItem?: (item: I) => void;
  /** Цвет полосы по элементу — обычно по статусу. */
  barColor?: (item: I) => string;
  /** Локаль подписей шкалы. По умолчанию — локаль браузера. */
  locale?: string;
  labels?: GanttLabels;
}

/**
 * Диаграмма Ганта: элементы с датами как полосы, которые можно двигать
 * и растягивать за края.
 *
 * Домена диаграмма не знает: подпись строки рисует `renderLabel`, цвет
 * полосы даёт `barColor`, а сохранение дат — `onChangeDates`.
 *
 * Вся математика (шкала, раскладка, критический путь, применение
 * перетаскивания) вынесена в ./ganttLayout.ts — там же её тесты.
 */
export function Gantt<I extends GanttItem>({
  items,
  edges = [],
  renderLabel,
  onChangeDates,
  onOpenItem,
  barColor,
  locale,
  labels = {},
}: GanttProps<I>) {
  const [, startTransition] = useTransition();
  const [drag, setDrag] = useState<GanttDrag | null>(null);
  const dragRef = useRef<GanttDrag | null>(null);

  // Полотно листается протяжкой по обеим осям. Полосы гасят всплытие
  // в своём onPointerDown, поэтому тянутся сами, а не двигают полотно.
  const scrollRef = useDragScroll<HTMLDivElement>({ axis: "both", keyboard: true });

  const rows = datedRows(items);
  const scale = buildScale(rows, { locale });

  if (!scale) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-edge p-6 text-center text-sm text-muted">
        {labels.empty ?? "Nothing to show: no items have a start or due date yet."}
      </div>
    );
  }

  const { scaleStart, totalDays, dayWidth, todayOffset, months } = scale;
  const layout = layoutBars(rows, scaleStart);
  const ids = new Set(layout.keys());
  const usableEdges = edges.filter(
    (e) => ids.has(e.fromId) && ids.has(e.toId) && e.fromId !== e.toId
  );
  const critical = criticalPath(ids, usableEdges, (id) => layout.get(id)!.span);

  const chartW = totalDays * dayWidth;
  const chartH = rows.length * ROW_H;

  function startDrag(e: React.PointerEvent, mode: DragMode, from: Date, to: Date, itemId: string) {
    if (!onChangeDates) return;
    e.preventDefault();
    // Полотно тоже слушает pointerdown: без остановки всплытия полоса
    // тянулась бы вместе с прокруткой всей диаграммы
    e.stopPropagation();

    const state: GanttDrag = {
      itemId,
      mode,
      startX: e.clientX,
      origFrom: from.getTime(),
      origTo: to.getTime(),
      delta: 0,
    };
    dragRef.current = state;
    setDrag(state);

    function onMove(ev: PointerEvent) {
      const current = dragRef.current;
      if (!current) return;
      const delta = deltaDays(ev.clientX, current.startX, dayWidth);
      if (delta === current.delta) return;
      const next = { ...current, delta };
      dragRef.current = next;
      setDrag(next);
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const current = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      // Нулевой сдвиг — это клик, а не перетаскивание: сохранять нечего
      if (!current || current.delta === 0) return;

      const { from: nextFrom, to: nextTo } = applyDrag(current);
      startTransition(async () => {
        await onChangeDates?.(current.itemId, {
          startDate: toISODate(nextFrom),
          dueDate: toISODate(nextTo),
        });
      });
    }

    // Слушаем на window, а не на полосе: курсор во время жеста уходит
    // далеко за её пределы
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  /** Смещение и длительность полосы с учётом идущего перетаскивания. */
  function placement(itemId: string) {
    const base = layout.get(itemId)!;
    if (!drag || drag.itemId !== itemId) return base;
    const { from, to } = applyDrag(drag);
    return {
      row: base.row,
      offset: Math.round((from - scaleStart.getTime()) / 86_400_000),
      span: Math.round((to - from) / 86_400_000) + 1,
    };
  }

  return (
    <div className="flex h-full flex-col">
      {(critical.ids.size > 0 || usableEdges.length > 0) && (
        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          {critical.ids.size > 0 && (
            <span className="flex items-center gap-1.5">
              <span style={{ color: CRITICAL_COLOR }} aria-hidden>
                ⚡
              </span>
              {labels.criticalPath ?? "Critical path"}:{" "}
              <b className="text-foreground">{critical.ids.size}</b>
            </span>
          )}
          {usableEdges.length > 0 && (
            <span>
              {labels.links ?? "Dependencies"}: {usableEdges.length}
            </span>
          )}
        </div>
      )}

      <div
        ref={scrollRef}
        role="region"
        aria-label={labels.region}
        className="min-h-0 flex-1 overflow-auto rounded-2xl border border-edge bg-surface"
      >
        <div style={{ width: LABEL_W + chartW, minWidth: "100%" }}>
          <div className="sticky top-0 z-10 flex border-b border-edge bg-surface">
            <div
              className="shrink-0 border-r border-edge px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted"
              style={{ width: LABEL_W }}
            >
              {labels.header ?? "Item"}
            </div>
            <div className="relative" style={{ width: chartW, height: 32 }}>
              {months.map((m, i) => (
                <span
                  key={i}
                  className="absolute top-2 text-xs text-muted"
                  style={{ left: m.dayOffset * dayWidth + 4 }}
                >
                  {m.label}
                </span>
              ))}
            </div>
          </div>

          <div className="relative">
            {todayOffset >= 0 && todayOffset <= totalDays && (
              <div
                aria-hidden
                data-tip={labels.today}
                className="pointer-events-none absolute bottom-0 top-0 z-0 w-px bg-accent/50"
                style={{ left: LABEL_W + todayOffset * dayWidth + dayWidth / 2 }}
              />
            )}

            {/* Стрелки зависимостей поверх строк: SVG наложен на всю сетку,
                поэтому линии не разрываются на границах строк */}
            <svg
              aria-hidden
              className="pointer-events-none absolute left-0 top-0 z-[5]"
              width={LABEL_W + chartW}
              height={chartH}
            >
              {usableEdges.map((edge, i) => {
                const from = layout.get(edge.fromId)!;
                const to = layout.get(edge.toId)!;
                const x1 = LABEL_W + (from.offset + from.span) * dayWidth;
                const y1 = from.row * ROW_H + ROW_H / 2;
                const x2 = LABEL_W + to.offset * dayWidth;
                const y2 = to.row * ROW_H + ROW_H / 2;
                const onCritical =
                  critical.ids.has(edge.fromId) &&
                  critical.ids.has(edge.toId) &&
                  critical.previous.get(edge.toId) === edge.fromId;
                const mid = x1 + Math.max(12, (x2 - x1) / 2);
                return (
                  <path
                    key={i}
                    d={`M ${x1} ${y1} H ${mid} V ${y2} H ${x2}`}
                    fill="none"
                    stroke={onCritical ? CRITICAL_COLOR : "var(--muted)"}
                    strokeWidth={onCritical ? 2 : 1}
                    strokeOpacity={onCritical ? 0.9 : 0.4}
                  />
                );
              })}
            </svg>

            {rows.map((row) => {
              const place = placement(row.item.id);
              const onCritical = critical.ids.has(row.item.id);
              const color = onCritical
                ? CRITICAL_COLOR
                : (row.item.color ?? barColor?.(row.item) ?? "var(--accent)");
              const dragging = drag?.itemId === row.item.id;

              return (
                <div
                  key={row.item.id}
                  className="flex border-b border-edge/40 last:border-0"
                  style={{ height: ROW_H }}
                >
                  <div
                    className="flex shrink-0 items-center gap-2 overflow-hidden border-r border-edge px-4 text-sm"
                    style={{ width: LABEL_W }}
                  >
                    {renderLabel(row.item)}
                  </div>

                  <div className="relative" style={{ width: chartW }}>
                    <div
                      role={onOpenItem ? "button" : undefined}
                      tabIndex={onOpenItem ? 0 : undefined}
                      onPointerDown={(e) => startDrag(e, "move", row.from, row.to, row.item.id)}
                      onClick={() => {
                        // Клик после перетаскивания открывать элемент не должен
                        if (!dragging) onOpenItem?.(row.item);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") onOpenItem?.(row.item);
                      }}
                      className={`absolute top-1.5 flex h-6 items-center rounded-md transition-[opacity] ${
                        onChangeDates ? "cursor-grab active:cursor-grabbing" : ""
                      } ${dragging ? "opacity-80" : ""}`}
                      style={{
                        left: place.offset * dayWidth + 2,
                        width: Math.max(place.span * dayWidth - 4, 6),
                        backgroundColor: color,
                      }}
                    >
                      {onChangeDates && (
                        <>
                          {/* Ручки краёв: узкие полоски по бокам полосы.
                              Проявляются при наведении, чтобы не мельтешить. */}
                          <span
                            onPointerDown={(e) =>
                              startDrag(e, "start", row.from, row.to, row.item.id)
                            }
                            className="absolute left-0 h-full w-1.5 cursor-ew-resize rounded-l-md bg-black/20 opacity-0 transition hover:opacity-100"
                          />
                          <span
                            onPointerDown={(e) =>
                              startDrag(e, "end", row.from, row.to, row.item.id)
                            }
                            className="absolute right-0 h-full w-1.5 cursor-ew-resize rounded-r-md bg-black/20 opacity-0 transition hover:opacity-100"
                          />
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
