"use client";

import { Fragment, useRef, useState, useTransition, type ReactNode } from "react";
import { useDragScroll } from "@toimetdev/pathlogs-hooks";
import { ConfirmDialog, DragScroll } from "@toimetdev/pathlogs-core";
import {
  applyOrder,
  columnItems,
  dropSlotIndex,
  hiddenColumns,
  hoverIndex,
  insertAt,
  isOverWipLimit,
  reorderColumns,
  visibleColumns,
  type KanbanColumnLike,
  type KanbanItemLike,
  type KanbanSort,
} from "@/components/ui/kanban/kanbanOrder";
import { ColumnEditor } from "@/components/ui/kanban/ColumnEditor";

export type { KanbanSort };

export interface KanbanColumn extends KanbanColumnLike {
  name: string;
  /** Цвет колонки в #rrggbb: им подкрашивается вся колонка. */
  color: string;
}

export interface KanbanItem extends KanbanItemLike {
  /** Персональный цвет карточки. */
  color?: string | null;
}

export interface KanbanCardContext {
  /** Карточка сейчас перетаскивается — источник скрыт, на его месте слот. */
  dragging: boolean;
  column: KanbanColumn;
}

export interface KanbanLabels {
  addColumn?: string;
  columnName?: string;
  dragColumn?: string;
  configureColumn?: string;
  renameHint?: string;
  deleteTitle?: string;
  deleteMessage?: string;
  hiddenColumns?: string;
  restore?: string;
  save?: string;
  cancel?: string;
  hide?: string;
  delete?: string;
  color?: string;
  wipLimit?: string;
  wipLimitHint?: string;
  cardOrder?: string;
  sortManual?: string;
  sortNewest?: string;
  sortOldest?: string;
}

export interface KanbanProps<I extends KanbanItem, C extends KanbanColumn> {
  items: I[];
  columns: C[];
  /** Содержимое карточки. Всё, что специфично для домена, живёт здесь. */
  renderCard: (item: I, context: KanbanCardContext) => ReactNode;
  /**
   * Подвал колонки под списком карточек: обычно форма «добавить карточку».
   * Движок не знает, как создаётся элемент, — это забота домена.
   */
  renderColumnFooter?: (column: C) => ReactNode;

  /**
   * Карточка переехала. `orderedIds` — полный новый порядок целевой колонки,
   * а не только позиция: сервер должен записать порядок целиком, иначе
   * два одновременных переноса разъедутся.
   */
  onMoveItem: (itemId: string, columnId: string, orderedIds: string[]) => void | Promise<unknown>;
  onReorderColumns?: (orderedIds: string[]) => void | Promise<unknown>;
  onCreateColumn?: (name: string, color: string) => void | Promise<unknown>;
  onUpdateColumn?: (
    columnId: string,
    fields: { name: string; color: string; wipLimit: number | null; sort: KanbanSort }
  ) => void | Promise<unknown>;
  onSetColumnHidden?: (columnId: string, hidden: boolean) => void | Promise<unknown>;
  onDeleteColumn?: (columnId: string) => void | Promise<unknown>;
  /** Клик по карточке. */
  onOpenItem?: (item: I) => void;
  /**
   * Клавиша по карточке в фокусе (кроме Enter/Space — те открывают карточку).
   * Домен вешает сюда свои действия: у задач это «d» — отметить выполненной.
   */
  onItemKeyDown?: (item: I, event: React.KeyboardEvent) => void;

  /** Фильтр карточек. Колонки остаются на месте — видно и структуру, и остаток. */
  filter?: (item: I) => boolean;
  /** Право менять состав колонок. */
  canManageColumns?: boolean;
  /** Палитра для колонок и карточек. */
  palette?: readonly string[];
  /** Полоса над доской: фильтр, индикатор живых обновлений. */
  toolbar?: ReactNode;
  labels?: KanbanLabels;
  /** Доступное описание области доски для скринридера. */
  "aria-label"?: string;
}

const DEFAULT_PALETTE = [
  "#94a3b8",
  "#60a5fa",
  "#6366f1",
  "#c084fc",
  "#ec4899",
  "#ef4444",
  "#f59e0b",
  "#84cc16",
  "#4ade80",
  "#14b8a6",
] as const;

/** Прозрачное место, куда встанет карточка. Высота — от самой карточки. */
function DropSlot({ height }: { height: number }) {
  return (
    <div
      aria-hidden
      className="rounded-xl border-2 border-dashed border-accent/60 bg-accent/5"
      style={{ height: height || 72 }}
    />
  );
}

/** Счётчик карточек и WIP-лимит. Краснеет, когда лимит превышен. */
function WipBadge({ count, limit }: { count: number; limit: number | null | undefined }) {
  const over = isOverWipLimit(count, limit);
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs ${
        over ? "bg-red-500/20 font-semibold text-red-400" : "bg-surface-2 text-muted"
      }`}
    >
      {limit != null ? `${count}/${limit}` : count}
    </span>
  );
}

/** Заголовок колонки с переименованием по двойному клику. */
function ColumnTitle({
  name,
  onRename,
  hint,
}: {
  name: string;
  onRename: (name: string) => void;
  hint?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);

  function commit() {
    const trimmed = value.trim();
    setEditing(false);
    if (trimmed && trimmed !== name) onRename(trimmed);
  }

  if (!editing) {
    return (
      <h3
        className="cursor-text text-sm font-semibold"
        data-tip={hint}
        onDoubleClick={() => {
          setValue(name);
          setEditing(true);
        }}
      >
        {name}
      </h3>
    );
  }

  return (
    <input
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setEditing(false);
      }}
      className="w-full rounded border border-accent bg-surface-2 px-1.5 py-0.5 text-sm font-semibold outline-none"
    />
  );
}

/** Кнопка «новая колонка», разворачивающаяся в форму. */
function AddColumn({
  onCreate,
  palette,
  labels,
}: {
  onCreate: (name: string, color: string) => void;
  palette: readonly string[];
  labels: KanbanLabels;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(palette[0]!);

  function create() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed, color);
    setName("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-fit w-72 shrink-0 items-center justify-center gap-2 rounded-2xl border border-dashed border-edge/80 py-4 text-sm text-muted transition hover:border-accent/60 hover:text-foreground"
      >
        + {labels.addColumn ?? "New column"}
      </button>
    );
  }

  return (
    <div className="flex h-fit w-72 shrink-0 flex-col gap-3 rounded-2xl border border-edge bg-surface/60 p-4">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") create();
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder={labels.columnName ?? "Column name"}
        className="w-full rounded-lg border border-edge bg-surface-2 px-2.5 py-1.5 text-sm outline-none transition focus:border-accent"
      />
      <div className="flex flex-wrap gap-1.5">
        {palette.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            aria-label={c}
            className={`h-5 w-5 rounded-full border transition hover:scale-110 ${
              color === c ? "border-foreground" : "border-edge"
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={create}
          disabled={!name.trim()}
          className="flex-1 rounded-lg bg-accent py-1.5 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-50"
        >
          {labels.save ?? "Save"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-edge px-3 py-1.5 text-sm text-muted transition hover:text-foreground"
        >
          {labels.cancel ?? "Cancel"}
        </button>
      </div>
    </div>
  );
}

/**
 * Канбан-доска с перетаскиванием карточек и колонок, WIP-лимитами
 * и оптимистичным состоянием.
 *
 * Доска ничего не знает о домене: что показывать на карточке, решает
 * `renderCard`, а что делать с переносом — `onMoveItem`. Поэтому одна и та же
 * доска обслуживает задачи, заявки, кандидатов и что угодно ещё со списком
 * и порядком.
 *
 * Правила порядка вынесены в ./kanbanOrder.ts — там же их тесты.
 */
export function Kanban<I extends KanbanItem, C extends KanbanColumn>({
  items: initialItems,
  columns: initialColumns,
  renderCard,
  renderColumnFooter,
  onMoveItem,
  onReorderColumns,
  onCreateColumn,
  onUpdateColumn,
  onSetColumnHidden,
  onDeleteColumn,
  onOpenItem,
  onItemKeyDown,
  filter,
  canManageColumns = false,
  palette = DEFAULT_PALETTE,
  toolbar,
  labels = {},
  ...rest
}: KanbanProps<I, C>) {
  const [items, setItems] = useState(initialItems);
  const [columns, setColumns] = useState(initialColumns);
  const [isPending, startTransition] = useTransition();

  // Доску листаем протяжкой; карточки и ручки колонок остаются
  // перетаскиваемыми — при их drag&drop протяжка отменяется сама.
  const boardRef = useDragScroll<HTMLDivElement>({ keyboard: true });

  /**
   * Свежие props с сервера заменяют локальное (оптимистичное) состояние —
   * но только когда все начатые действия завершились. Иначе ревалидация
   * одного переноса перезатёрла бы более свежий результат другого:
   * при быстрых кликах карточки прыгали бы назад.
   */
  const [prevItems, setPrevItems] = useState(initialItems);
  if (initialItems !== prevItems && !isPending) {
    setPrevItems(initialItems);
    setItems(initialItems);
  }
  const [prevColumns, setPrevColumns] = useState(initialColumns);
  if (initialColumns !== prevColumns && !isPending) {
    setPrevColumns(initialColumns);
    setColumns(initialColumns);
  }

  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<{ colId: string; index: number } | null>(null);
  const [dragHeight, setDragHeight] = useState(0);
  /**
   * Что схватили. Заполняется в dragstart, а в состояние применяется на первом
   * drag: dragstart — дискретное событие, и синхронный setState спрятал бы
   * источник прямо в момент старта, отменив перенос.
   */
  const dragMeta = useRef<{ id: string; height: number } | null>(null);

  const [dragColId, setDragColId] = useState<string | null>(null);
  const [overColDrag, setOverColDrag] = useState<string | null>(null);
  const [editorFor, setEditorFor] = useState<string | null>(null);
  const [editorRect, setEditorRect] = useState<DOMRect | null>(null);
  const [colToRemove, setColToRemove] = useState<C | null>(null);

  const shown = visibleColumns(columns);
  const hidden = hiddenColumns(columns);
  const filtering = Boolean(filter);

  function listOf(column: C): I[] {
    return columnItems(items, column);
  }

  /** Карточки колонки без перетаскиваемой: по ним считаются позиции. */
  function listWithoutDragged(column: C): I[] {
    const list = listOf(column);
    return dragId ? list.filter((t) => t.id !== dragId) : list;
  }

  /** То, что реально видно: список за вычетом отсеянных фильтром. */
  function visibleIn(column: C): I[] {
    const list = listWithoutDragged(column);
    return filter ? list.filter(filter) : list;
  }

  function slotIndex(column: C, list: I[], hovered: number): number {
    return dropSlotIndex({
      column,
      list,
      hovered,
      dragged: items.find((t) => t.id === dragId),
      filtering,
    });
  }

  /**
   * Что рисуем в колонке: карточки без перетаскиваемой плюс сама
   * перетаскиваемая «призраком». Призрак скрыт через hidden — места
   * не занимает, но остаётся в дереве, поэтому его onDragEnd сработает,
   * даже если перенос отменили клавишей Escape.
   */
  function renderList(column: C, visible: I[], slot: number) {
    const rows = visible.map((item, index) => ({ item, index, ghost: false }));
    const dragged = items.find((t) => t.id === dragId);
    if (dragged && dragged.columnId === column.id) {
      rows.push({ item: dragged, index: slot, ghost: true });
    }
    return rows;
  }

  function hoverCard(colId: string, index: number, e: React.DragEvent) {
    e.preventDefault(); // разрешаем бросить карточку сюда
    if (!dragId) return; // тащим колонку, а не карточку
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const next = hoverIndex(index, e.clientY, rect.top, rect.height);
    setOver((prev) =>
      prev && prev.colId === colId && prev.index === next ? prev : { colId, index: next }
    );
  }

  function dropCard(column: C) {
    const id = dragId;
    if (!id) return;

    const list = listWithoutDragged(column);
    // Карточка встаёт ровно туда, где показывали слот. Если слот не успел
    // появиться (бросили мимо карточек) — в конец колонки.
    const at =
      over && over.colId === column.id && !filtering
        ? slotIndex(column, list, over.index)
        : list.length;
    const orderedIds = insertAt(list.map((t) => t.id), id, at);

    setDragId(null);
    setOver(null);
    setItems((prev) => applyOrder(prev, column.id, orderedIds));
    startTransition(async () => {
      await onMoveItem(id, column.id, orderedIds);
    });
  }

  function dropColumn(targetId: string) {
    const id = dragColId;
    setDragColId(null);
    setOverColDrag(null);
    if (!id || !onReorderColumns) return;

    const orderedIds = reorderColumns(shown.map((c) => c.id), id, targetId);
    if (orderedIds === shown.map((c) => c.id)) return;

    setColumns((prev) =>
      prev.map((c) => ({ ...c, order: (orderedIds.indexOf(c.id) + 1) * 10 }))
    );
    startTransition(async () => {
      await onReorderColumns(orderedIds);
    });
  }

  function renameColumn(colId: string, name: string) {
    const column = columns.find((c) => c.id === colId);
    if (!column || !onUpdateColumn) return;
    setColumns((prev) => prev.map((c) => (c.id === colId ? { ...c, name } : c)));
    startTransition(async () => {
      await onUpdateColumn(colId, {
        name,
        color: column.color,
        wipLimit: column.wipLimit ?? null,
        sort: column.sort ?? "MANUAL",
      });
    });
  }

  function saveColumn(
    colId: string,
    fields: { name: string; color: string; wipLimit: number | null; sort: KanbanSort }
  ) {
    setColumns((prev) => prev.map((c) => (c.id === colId ? { ...c, ...fields } : c)));
    startTransition(async () => {
      await onUpdateColumn?.(colId, fields);
    });
  }

  function setColumnHidden(colId: string, hiddenNow: boolean) {
    setColumns((prev) => prev.map((c) => (c.id === colId ? { ...c, hidden: hiddenNow } : c)));
    startTransition(async () => {
      await onSetColumnHidden?.(colId, hiddenNow);
    });
  }

  function removeColumn(column: C) {
    setColToRemove(null);
    // Карточки удалённой колонки переезжают в первую оставшуюся — повторяем
    // это оптимистично, иначе они мигнут и на кадр пропадут с доски
    const fallback = shown.find((c) => c.id !== column.id)?.id ?? null;
    const moved = new Set(listOf(column).map((t) => t.id));
    setColumns((prev) => prev.filter((c) => c.id !== column.id));
    setItems((prev) => prev.map((t) => (moved.has(t.id) ? { ...t, columnId: fallback } : t)));
    startTransition(async () => {
      await onDeleteColumn?.(column.id);
    });
  }

  function createColumn(name: string, color: string) {
    startTransition(async () => {
      await onCreateColumn?.(name, color);
    });
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {toolbar}

      <div
        ref={boardRef}
        role="region"
        aria-label={rest["aria-label"]}
        className="flex min-h-0 flex-1 gap-4 overflow-x-auto pb-4"
      >
        {shown.map((col) => {
          const all = listOf(col);
          const wipOver = isOverWipLimit(all.length, col.wipLimit);
          const isColTarget = Boolean(dragColId) && overColDrag === col.id && dragColId !== col.id;
          const isCardTarget = Boolean(dragId) && over?.colId === col.id;
          const visible = visibleIn(col);
          const slot = isCardTarget ? slotIndex(col, visible, over!.index) : -1;

          // Колонка окрашена своим цветом: заметно выделяется на любом фоне
          // страницы и сразу читается как отдельный список
          const tint = wipOver ? "#ef4444" : col.color;
          const highlight = isCardTarget || isColTarget;

          return (
            <div
              key={col.id}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragColId) {
                  setOverColDrag(col.id);
                } else if (dragId) {
                  // Над пустым местом колонки позицию не сбрасываем в конец:
                  // держим ту, что показали над карточками. В конец — только
                  // при заходе в другую колонку.
                  setOver((prev) =>
                    prev && prev.colId === col.id
                      ? prev
                      : { colId: col.id, index: listWithoutDragged(col).length }
                  );
                }
              }}
              onDragLeave={(e) => {
                // Переход между карточками внутри колонки — тоже dragleave;
                // сбрасываем, только когда курсор реально покинул колонку
                if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
                setOver((prev) => (prev?.colId === col.id ? null : prev));
                setOverColDrag((c) => (c === col.id ? null : c));
              }}
              onDrop={() => (dragColId ? dropColumn(col.id) : dropCard(col))}
              className={`flex w-[85vw] max-w-[20rem] shrink-0 flex-col rounded-2xl border transition sm:w-80 ${
                isColTarget ? "border-dashed" : ""
              }`}
              // Каждая граница отдельным свойством: сокращённое borderColor
              // и borderTopColor React обновляет независимо, и верхняя полоса
              // «залипает» от прошлого состояния
              style={{
                backgroundColor: `color-mix(in srgb, ${tint} 18%, var(--surface))`,
                borderTopColor: highlight ? "var(--accent)" : tint,
                borderRightColor: highlight ? "var(--accent)" : `${tint}80`,
                borderBottomColor: highlight ? "var(--accent)" : `${tint}80`,
                borderLeftColor: highlight ? "var(--accent)" : `${tint}80`,
                borderTopWidth: 3,
              }}
            >
              <div
                className="flex items-center gap-2 rounded-t-xl px-4 py-3"
                style={{ backgroundColor: `color-mix(in srgb, ${tint} 16%, transparent)` }}
              >
                {onReorderColumns && (
                  <span
                    draggable
                    onDragStart={(e) => {
                      // Без данных в dataTransfer Firefox перенос не начнёт
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", col.id);
                      setDragColId(col.id);
                      e.stopPropagation();
                    }}
                    onDragEnd={() => {
                      setDragColId(null);
                      setOverColDrag(null);
                    }}
                    data-tip={labels.dragColumn}
                    className="cursor-grab text-muted/60 transition hover:text-foreground active:cursor-grabbing"
                  >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                      <path d="M7 4a1 1 0 110 2 1 1 0 010-2zM7 9a1 1 0 110 2 1 1 0 010-2zM7 14a1 1 0 110 2 1 1 0 010-2zM13 4a1 1 0 110 2 1 1 0 010-2zM13 9a1 1 0 110 2 1 1 0 010-2zM13 14a1 1 0 110 2 1 1 0 010-2z" />
                    </svg>
                  </span>
                )}

                <span
                  aria-hidden
                  className="block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: col.color }}
                />

                <div className="min-w-0 flex-1">
                  <ColumnTitle
                    name={col.name}
                    hint={labels.renameHint}
                    onRename={(n) => renameColumn(col.id, n)}
                  />
                </div>

                <WipBadge count={all.length} limit={col.wipLimit} />

                {onUpdateColumn && (
                  <button
                    type="button"
                    data-tip={labels.configureColumn}
                    aria-label={`${labels.configureColumn ?? "Configure column"}: ${col.name}`}
                    onClick={(e) => {
                      if (editorFor === col.id) {
                        setEditorFor(null);
                      } else {
                        setEditorRect(e.currentTarget.getBoundingClientRect());
                        setEditorFor(col.id);
                      }
                    }}
                    className="shrink-0 rounded p-0.5 text-muted transition hover:bg-surface-2 hover:text-foreground"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                    </svg>
                  </button>
                )}

                {editorFor === col.id && editorRect && (
                  <ColumnEditor
                    column={col}
                    anchorRect={editorRect}
                    palette={palette}
                    labels={labels}
                    canDelete={Boolean(onDeleteColumn) && canManageColumns && columns.length > 1}
                    canHide={Boolean(onSetColumnHidden) && shown.length > 1}
                    onSave={(fields) => saveColumn(col.id, fields)}
                    onHide={() => setColumnHidden(col.id, true)}
                    onDelete={() => setColToRemove(col)}
                    onClose={() => setEditorFor(null)}
                  />
                )}
              </div>

              {/* Тело колонки листается протяжкой по вертикали, а при переносе
                  карточки к её краю подкручивается само (см. useDragScroll) */}
              <DragScroll axis="y" className="flex-1 space-y-2.5 overflow-y-auto px-3 pb-3 pt-1.5">
                {renderList(col, visible, slot).map(({ item, index, ghost }) => (
                  <Fragment key={item.id}>
                    {index === slot && !ghost && <DropSlot height={dragHeight} />}
                    <div
                      hidden={ghost}
                      draggable
                      role="button"
                      tabIndex={0}
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", item.id);
                        // Слот повторяет размер карточки — соседи не «прыгают»
                        dragMeta.current = { id: item.id, height: e.currentTarget.offsetHeight };
                      }}
                      onDrag={() => {
                        // Первый drag: перенос уже точно начался, прятать
                        // источник безопасно
                        const meta = dragMeta.current;
                        if (meta && dragId !== meta.id) {
                          setDragHeight(meta.height);
                          setDragId(meta.id);
                        }
                      }}
                      onDragEnd={() => {
                        dragMeta.current = null;
                        setDragId(null);
                        setOver(null);
                      }}
                      onDragOver={(e) => hoverCard(col.id, index, e)}
                      onClick={() => onOpenItem?.(item)}
                      onKeyDown={(e) => {
                        // Клавиши только когда фокус на самой карточке,
                        // а не на вложенных кнопках
                        if (e.target !== e.currentTarget) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onOpenItem?.(item);
                          return;
                        }
                        // Прочие клавиши отдаём домену (у задач «d» — «готово»)
                        onItemKeyDown?.(item, e);
                      }}
                      className="group cursor-pointer rounded-xl border border-edge bg-surface p-3.5 outline-none transition hover:border-accent/50 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40"
                      style={
                        item.color
                          ? { backgroundColor: `${item.color}1f`, borderColor: `${item.color}66` }
                          : undefined
                      }
                    >
                      {renderCard(item, { dragging: dragId === item.id, column: col })}
                    </div>
                  </Fragment>
                ))}

                {/* Слот в конце списка: бросок под последнюю карточку */}
                {slot === visible.length && slot >= 0 && <DropSlot height={dragHeight} />}
              </DragScroll>

              {/* Подвал колонки: домен обычно ставит сюда «добавить карточку» */}
              {renderColumnFooter && <div className="px-3 pb-3">{renderColumnFooter(col)}</div>}
            </div>
          );
        })}

        {onCreateColumn && canManageColumns && (
          <AddColumn onCreate={createColumn} palette={palette} labels={labels} />
        )}
      </div>

      {hidden.length > 0 && onSetColumnHidden && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>{labels.hiddenColumns ?? "Hidden columns"}:</span>
          {hidden.map((col) => (
            <button
              key={col.id}
              type="button"
              onClick={() => setColumnHidden(col.id, false)}
              className="flex items-center gap-1.5 rounded-full border border-edge px-2.5 py-1 transition hover:bg-surface-2 hover:text-foreground"
            >
              <span
                aria-hidden
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: col.color }}
              />
              {col.name}
              <span className="opacity-60">· {labels.restore ?? "restore"}</span>
            </button>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={colToRemove !== null}
        title={labels.deleteTitle ?? "Delete column?"}
        message={
          colToRemove
            ? (labels.deleteMessage ?? "Cards will move to the first remaining column.")
            : undefined
        }
        onConfirm={() => colToRemove && removeColumn(colToRemove)}
        onCancel={() => setColToRemove(null)}
      />
    </div>
  );
}
