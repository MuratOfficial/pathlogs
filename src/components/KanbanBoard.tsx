"use client";

import { Fragment, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { TaskDTO, ColumnDTO, MemberDTO, TaskTemplateDTO, TagDTO } from "@/lib/types";
import { NewTaskDialog } from "./NewTaskDialog";
import {
  createBoardColumnAction,
  updateBoardColumnAction,
  deleteBoardColumnAction,
  setBoardColumnHiddenAction,
  moveTaskAction,
  reorderColumnsAction,
  updateTaskColorAction,
} from "@/lib/actions/board";
import type { ColumnSort } from "@prisma/client";
import { updateTaskStatusAction } from "@/lib/actions/tasks";
import { BOARD_PALETTE, formatDate, formatHours } from "@/lib/labels";
import { ConfirmDialog } from "./ConfirmDialog";
import { AssigneeAvatars, PriorityBadge, TagChips, TypeBadge } from "./TaskBadges";
import { useDragScroll } from "./useDragScroll";
import { DragScroll } from "./DragScroll";

// Размеры popover для расчёта позиции (ширина w-44 + переворот при нехватке места)
const PALETTE_W = 176;
const PALETTE_H = 124;

function ColorPalette({
  anchorRect,
  onPick,
  onClose,
  allowReset,
}: {
  anchorRect: DOMRect;
  onPick: (color: string | null) => void;
  onClose: () => void;
  allowReset?: boolean;
}) {
  // Позиционируем относительно кнопки-триггера через fixed — popover выходит
  // за пределы overflow-контейнера колонки и не обрезается.
  const gap = 6;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.min(Math.max(8, anchorRect.left), vw - PALETTE_W - 8);
  let top = anchorRect.bottom + gap;
  if (top + PALETTE_H > vh - 8) {
    const above = anchorRect.top - gap - PALETTE_H;
    top = above >= 8 ? above : Math.max(8, vh - PALETTE_H - 8);
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        style={{ position: "fixed", top, left, width: PALETTE_W }}
        className="z-50 flex flex-wrap gap-1.5 rounded-xl border border-edge bg-surface-2 p-2.5 shadow-2xl"
      >
        {BOARD_PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              onPick(c);
              onClose();
            }}
            className="h-6 w-6 rounded-full border border-edge transition hover:scale-110"
            style={{ backgroundColor: c }}
            data-tip={c}
          />
        ))}
        {allowReset && (
          <button
            type="button"
            onClick={() => {
              onPick(null);
              onClose();
            }}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-edge text-[10px] text-muted transition hover:scale-110 hover:text-foreground"
            data-tip="Сбросить цвет"
          >
            ✕
          </button>
        )}
      </div>
    </>,
    document.body
  );
}

function AddColumn({
  onCreate,
}: {
  onCreate: (name: string, color: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(BOARD_PALETTE[0]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-fit w-72 shrink-0 items-center justify-center gap-2 rounded-2xl border border-dashed border-edge/80 py-4 text-sm text-muted transition hover:border-accent/60 hover:text-foreground"
      >
        + Новая колонка
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
          if (e.key === "Enter" && name.trim()) {
            onCreate(name, color);
            setName("");
            setOpen(false);
          }
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Название колонки"
        className="w-full rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm outline-none transition focus:border-accent"
      />
      <div className="flex flex-wrap gap-1.5">
        {BOARD_PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            className={`h-6 w-6 rounded-full border transition hover:scale-110 ${
              color === c ? "border-foreground" : "border-edge"
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!name.trim()}
          onClick={() => {
            onCreate(name, color);
            setName("");
            setOpen(false);
          }}
          className="flex-1 rounded-lg bg-accent py-1.5 text-sm font-semibold transition hover:bg-accent-hover disabled:opacity-50"
        >
          Добавить
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-edge px-3 py-1.5 text-sm text-muted transition hover:text-foreground"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}

/**
 * Прозрачный слот на месте будущей карточки: при перетаскивании видно, куда
 * именно она встанет. Высота равна высоте перетаскиваемой карточки, поэтому
 * соседние карточки расступаются ровно на нужное место.
 */
function DropSlot({ height }: { height: number }) {
  return (
    <div
      aria-hidden
      style={{ height: height || 96 }}
      className="rounded-xl border-2 border-dashed border-accent/70 bg-accent/10"
    />
  );
}

/** Бейдж количества карточек; подсвечивается красным при превышении WIP-лимита. */
function WipBadge({ count, limit }: { count: number; limit: number | null }) {
  const over = limit != null && count > limit;
  return (
    <span
      data-tip={limit != null ? `WIP-лимит: ${limit}` : undefined}
      className={`rounded-full px-2 py-0.5 text-xs ${
        over ? "bg-red-500/20 font-semibold text-red-400" : "bg-surface-2 text-muted"
      }`}
    >
      {limit != null ? `${count}/${limit}` : count}
    </span>
  );
}

// Размеры поповера редактирования колонки для расчёта позиции
const EDITOR_W = 264;
const EDITOR_H = 420;

/** Порядок карточек внутри колонки — подписи для селекта. */
const SORT_LABELS: Record<ColumnSort, string> = {
  MANUAL: "Вручную (перетаскиванием)",
  CREATED_DESC: "По дате создания: новые сверху",
  CREATED_ASC: "По дате создания: старые сверху",
};

/**
 * Поповер редактирования колонки: название, цвет, WIP-лимит, порядок карточек,
 * скрытие и удаление. Одно понятное место вместо разрозненных инлайн-контролов.
 */
function ColumnEditor({
  column,
  anchorRect,
  canDelete,
  canHide,
  onSave,
  onHide,
  onDelete,
  onClose,
}: {
  column: ColumnDTO;
  anchorRect: DOMRect;
  canDelete: boolean;
  canHide: boolean;
  onSave: (fields: {
    name: string;
    color: string;
    wipLimit: number | null;
    sort: ColumnSort;
  }) => void;
  onHide: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(column.name);
  const [color, setColor] = useState(column.color);
  const [wip, setWip] = useState(column.wipLimit != null ? String(column.wipLimit) : "");
  const [sort, setSort] = useState<ColumnSort>(column.sort);

  const gap = 6;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.min(Math.max(8, anchorRect.right - EDITOR_W), vw - EDITOR_W - 8);
  let top = anchorRect.bottom + gap;
  if (top + EDITOR_H > vh - 8) {
    const above = anchorRect.top - gap - EDITOR_H;
    top = above >= 8 ? above : Math.max(8, vh - EDITOR_H - 8);
  }

  function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const n = parseInt(wip, 10);
    onSave({
      name: trimmed,
      color,
      wipLimit: Number.isFinite(n) && n > 0 ? n : null,
      sort,
    });
    onClose();
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        style={{ position: "fixed", top, left, width: EDITOR_W }}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") onClose();
        }}
        className="z-50 rounded-xl border border-edge bg-surface p-3.5 shadow-2xl"
      >
        <label className="mb-3 block">
          <span className="mb-1 block text-[11px] text-muted">Название</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-edge bg-surface-2 px-2.5 py-1.5 text-sm outline-none transition focus:border-accent"
          />
        </label>

        <span className="mb-1 block text-[11px] text-muted">Цвет</span>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {BOARD_PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Цвет ${c}`}
              className={`h-5 w-5 rounded-full border transition hover:scale-110 ${
                color === c ? "border-foreground" : "border-edge"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <label className="mb-3 block">
          <span className="mb-1 block text-[11px] text-muted">
            WIP-лимит <span className="opacity-70">· пусто — без лимита</span>
          </span>
          <input
            type="number"
            min={1}
            value={wip}
            placeholder="∞"
            onChange={(e) => setWip(e.target.value)}
            className="w-full rounded-lg border border-edge bg-surface-2 px-2.5 py-1.5 text-sm outline-none transition focus:border-accent"
          />
        </label>

        <label className="mb-4 block">
          <span className="mb-1 block text-[11px] text-muted">Порядок карточек</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as ColumnSort)}
            className="w-full rounded-lg border border-edge bg-surface-2 px-2.5 py-1.5 text-sm outline-none transition focus:border-accent"
          >
            {(Object.keys(SORT_LABELS) as ColumnSort[]).map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={!name.trim()}
            className="flex-1 rounded-lg bg-accent py-1.5 text-sm font-semibold transition hover:bg-accent-hover disabled:opacity-50"
          >
            Сохранить
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-edge px-3 py-1.5 text-sm text-muted transition hover:text-foreground"
          >
            Отмена
          </button>
        </div>

        {canHide && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onHide();
            }}
            data-tip="Задачи останутся в колонке — вернуть можно в любой момент"
            className="mt-2.5 w-full rounded-lg border border-edge py-1.5 text-xs font-medium text-muted transition hover:bg-surface-2 hover:text-foreground"
          >
            Скрыть колонку
          </button>
        )}

        {canDelete && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onDelete();
            }}
            className="mt-2 w-full rounded-lg border border-red-500/30 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/10"
          >
            Удалить колонку
          </button>
        )}
      </div>
    </>,
    document.body
  );
}

/** Заголовок колонки с инлайн-переименованием по двойному клику. */
function ColumnTitle({
  name,
  onRename,
}: {
  name: string;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);

  if (!editing) {
    return (
      <h3
        className="cursor-text text-sm font-semibold"
        data-tip="Двойной клик — переименовать"
        onDoubleClick={() => {
          setValue(name);
          setEditing(true);
        }}
      >
        {name}
      </h3>
    );
  }

  function commit() {
    const trimmed = value.trim();
    setEditing(false);
    if (trimmed && trimmed !== name) onRename(trimmed);
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

export function KanbanBoard({
  tasks: initialTasks,
  columns: initialColumns,
  projectId,
  projectKey,
  canManageBoard,
  members,
  templates = [],
  projectTags = [],
}: {
  tasks: TaskDTO[];
  columns: ColumnDTO[];
  projectId: string;
  projectKey: string;
  /** Право удалять колонки (менеджер проекта, владелец или админ). */
  canManageBoard: boolean;
  /** Для формы «+ Задача» внутри колонки. */
  members: MemberDTO[];
  templates?: TaskTemplateDTO[];
  projectTags?: TagDTO[];
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [columns, setColumns] = useState(initialColumns);

  // Доску листаем протяжкой: карточки и ручки колонок остаются
  // перетаскиваемыми — при их drag&drop протяжка отменяется.
  const boardRef = useDragScroll<HTMLDivElement>({ keyboard: true });

  const [isPending, startTransition] = useTransition();

  // После ревалидации сервер присылает свежие props — сбрасываем локальное
  // (оптимистичное) состояние на серверную правду прямо во время рендера.
  // Пока есть незавершённые действия (isPending) — доверяем оптимистичному
  // состоянию: иначе ревалидация одного действия перезатёрла бы более свежее
  // оптимистичное изменение другого (гонка при быстрых кликах). Когда все
  // действия завершатся, синхронизируемся с финальной серверной правдой.
  const [prevTasks, setPrevTasks] = useState(initialTasks);
  if (initialTasks !== prevTasks && !isPending) {
    setPrevTasks(initialTasks);
    setTasks(initialTasks);
  }
  const [prevColumns, setPrevColumns] = useState(initialColumns);
  if (initialColumns !== prevColumns && !isPending) {
    setPrevColumns(initialColumns);
    setColumns(initialColumns);
  }

  const [dragId, setDragId] = useState<string | null>(null); // перетаскиваемая карточка
  // Место вставки: колонка и позиция в её списке (без перетаскиваемой карточки).
  // Именно здесь рисуется прозрачный «слот» — как в Trello.
  const [over, setOver] = useState<{ colId: string; index: number } | null>(null);
  const [dragHeight, setDragHeight] = useState(0); // высота карточки — высота слота
  // Что схватили: заполняется в dragstart, применяется в состояние на первом
  // drag — иначе синхронный setState отменил бы начавшийся перенос
  const dragMeta = useRef<{ id: string; height: number } | null>(null);
  const [dragColId, setDragColId] = useState<string | null>(null); // перетаскиваемая колонка
  const [overColDrag, setOverColDrag] = useState<string | null>(null); // колонка-цель при переносе колонки
  const [paletteFor, setPaletteFor] = useState<string | null>(null); // id задачи (цвет карточки)
  const [paletteRect, setPaletteRect] = useState<DOMRect | null>(null); // якорь палитры
  const [editorFor, setEditorFor] = useState<string | null>(null); // id редактируемой колонки
  const [editorRect, setEditorRect] = useState<DOMRect | null>(null); // якорь редактора колонки
  const [colToRemove, setColToRemove] = useState<ColumnDTO | null>(null); // подтверждение удаления

  // Открыть/закрыть палитру, запомнив позицию кнопки-триггера
  function togglePalette(id: string, e: React.MouseEvent<HTMLButtonElement>) {
    if (paletteFor === id) {
      setPaletteFor(null);
    } else {
      setPaletteRect(e.currentTarget.getBoundingClientRect());
      setPaletteFor(id);
    }
  }

  function toggleEditor(colId: string, e: React.MouseEvent<HTMLButtonElement>) {
    if (editorFor === colId) {
      setEditorFor(null);
    } else {
      setEditorRect(e.currentTarget.getBoundingClientRect());
      setEditorFor(colId);
    }
  }

  const byOrder = [...columns].sort((a, b) => a.order - b.order);
  const sorted = byOrder.filter((c) => !c.hidden);
  const hiddenColumns = byOrder.filter((c) => c.hidden);

  function columnOf(t: TaskDTO): string | null {
    if (t.columnId && columns.some((c) => c.id === t.columnId)) return t.columnId;
    if (t.status === "CLOSED" || t.status === "ARCHIVED") return null;
    // Карточка без явной колонки показывается в колонке своего статуса —
    // но только в видимой, иначе она «уехала» бы в скрытую и пропала
    return sorted.find((c) => c.status === t.status)?.id ?? null;
  }

  function tasksOf(colId: string): TaskDTO[] {
    const col = columns.find((c) => c.id === colId);
    const list = tasks.filter((t) => columnOf(t) === colId);
    if (col?.sort === "CREATED_DESC") {
      return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    if (col?.sort === "CREATED_ASC") {
      return list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
    return list.sort((a, b) => a.order - b.order);
  }

  /** Список карточек колонки без перетаскиваемой — по нему считаются позиции. */
  function tasksWithoutDragged(colId: string): TaskDTO[] {
    const list = tasksOf(colId);
    return dragId ? list.filter((t) => t.id !== dragId) : list;
  }

  /**
   * Что рисуем в колонке: карточки без перетаскиваемой (для них важен индекс —
   * по нему ставится слот) плюс сама перетаскиваемая карточка «призраком».
   * Призрак скрыт через display:none: места не занимает, но остаётся в дереве,
   * поэтому его onDragEnd сработает, даже если перенос отменили.
   */
  function renderList(
    col: ColumnDTO,
    visible: TaskDTO[],
    slot: number
  ): { task: TaskDTO; index: number; ghost: boolean }[] {
    const items = visible.map((task, index) => ({ task, index, ghost: false }));
    const dragged = tasks.find((t) => t.id === dragId);
    if (dragged && columnOf(dragged) === col.id) {
      items.push({ task: dragged, index: slot, ghost: true });
    }
    return items;
  }

  /**
   * Позиция слота (и вставки) в колонке. При ручном порядке — там, где курсор.
   * При сортировке по дате порядок задаёт дата создания, поэтому показываем
   * слот там, где карточка действительно окажется, а не под курсором.
   */
  function dropSlotIndex(col: ColumnDTO, list: TaskDTO[], hovered: number): number {
    if (col.sort === "MANUAL") return Math.min(hovered, list.length);
    const dragged = tasks.find((t) => t.id === dragId);
    if (!dragged) return list.length;
    const desc = col.sort === "CREATED_DESC";
    const idx = list.findIndex((t) => {
      const cmp = t.createdAt.localeCompare(dragged.createdAt);
      return desc ? cmp < 0 : cmp > 0;
    });
    return idx === -1 ? list.length : idx;
  }

  /**
   * Куда встанет карточка при наведении на карточку `index`: выше или ниже
   * неё — по тому, в какой половине карточки курсор (как в Trello).
   */
  function hoverCard(colId: string, index: number, e: React.DragEvent) {
    e.preventDefault(); // разрешаем бросить карточку сюда
    // Перенос ещё не зарегистрирован (или тащим колонку) — позицию выставит
    // следующий dragover, они идут потоком
    if (!dragId) return;
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const below = e.clientY > rect.top + rect.height / 2;
    const next = index + (below ? 1 : 0);
    setOver((prev) =>
      prev && prev.colId === colId && prev.index === next ? prev : { colId, index: next }
    );
  }

  // ── Перенос карточки ──────────────────────────────────────────────
  function dropCard(col: ColumnDTO) {
    const id = dragId;
    if (!id) return;
    const list = tasksWithoutDragged(col.id);
    // Карточка встаёт ровно туда, где показывали слот. Если слот не успел
    // появиться (бросили мимо карточек) — в конец колонки.
    const insertIndex =
      over && over.colId === col.id
        ? dropSlotIndex(col, list, over.index)
        : list.length;
    const newIds = list.map((t) => t.id);
    newIds.splice(insertIndex, 0, id);

    setDragId(null);
    setOver(null);
    setTasks((prev) =>
      prev.map((t) => {
        const oi = newIds.indexOf(t.id);
        if (t.id === id) {
          return {
            ...t,
            columnId: col.id,
            status: col.status ?? t.status,
            order: oi >= 0 ? oi : t.order,
          };
        }
        return oi >= 0 ? { ...t, order: oi } : t;
      })
    );
    startTransition(() => moveTaskAction(id, col.id, newIds));
  }

  // ── Перестановка колонок ──────────────────────────────────────────
  function dropColumn(targetColId: string) {
    const id = dragColId;
    setDragColId(null);
    setOverColDrag(null);
    if (!id || id === targetColId) return;
    const order = sorted.map((c) => c.id).filter((cid) => cid !== id);
    const targetIdx = order.indexOf(targetColId);
    order.splice(targetIdx, 0, id);
    setColumns((prev) =>
      prev.map((c) => ({ ...c, order: (order.indexOf(c.id) + 1) * 10 }))
    );
    startTransition(() => reorderColumnsAction(projectId, order));
  }

  function createColumn(name: string, color: string) {
    startTransition(async () => {
      const res = await createBoardColumnAction(projectId, name, color);
      if (res.column) setColumns((prev) => [...prev, res.column!]);
    });
  }

  function renameColumn(colId: string, name: string) {
    setColumns((prev) => prev.map((c) => (c.id === colId ? { ...c, name } : c)));
    startTransition(() => updateBoardColumnAction(colId, { name }));
  }

  function saveColumn(
    colId: string,
    fields: { name: string; color: string; wipLimit: number | null; sort: ColumnSort }
  ) {
    setColumns((prev) => prev.map((c) => (c.id === colId ? { ...c, ...fields } : c)));
    startTransition(() => updateBoardColumnAction(colId, fields));
  }

  /** Скрыть колонку с доски или вернуть её обратно (задачи остаются в ней). */
  function setColumnHidden(colId: string, hidden: boolean) {
    setColumns((prev) => prev.map((c) => (c.id === colId ? { ...c, hidden } : c)));
    startTransition(() => setBoardColumnHiddenAction(colId, hidden));
  }

  function removeColumn(colId: string) {
    setColToRemove(null);
    // Задачи удалённой колонки на сервере переезжают в первую оставшуюся —
    // повторяем это оптимистично, чтобы карточки не мигали и не пропадали
    const fallback = sorted.find((c) => c.id !== colId)?.id ?? null;
    const moved = new Set(tasksOf(colId).map((t) => t.id));
    setColumns((prev) => prev.filter((c) => c.id !== colId));
    setTasks((prev) =>
      prev.map((t) => (moved.has(t.id) ? { ...t, columnId: fallback } : t))
    );
    startTransition(() => deleteBoardColumnAction(colId));
  }

  function recolorTask(taskId: string, color: string | null) {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, color } : t)));
    startTransition(() => updateTaskColorAction(taskId, color));
  }

  // Быстрая отметка «Готово» по клику на галочку (как в Trello).
  // Повторный клик снимает отметку и возвращает в «К выполнению».
  // Карточка при этом остаётся в своей колонке — статус её не двигает.
  function toggleTaskDone(t: TaskDTO) {
    const isDone = t.status === "DONE" || t.status === "CLOSED";
    const next = isDone ? "TODO" : "DONE";
    const stayIn = columnOf(t);
    setTasks((prev) =>
      prev.map((x) =>
        x.id === t.id ? { ...x, status: next, columnId: stayIn ?? x.columnId } : x
      )
    );
    startTransition(() => updateTaskStatusAction(t.id, next));
  }

  return (
    <div
      ref={boardRef}
      role="region"
      aria-label="Доска задач: стрелки прокручивают, Home и End — к краям"
      className="flex h-full gap-4 overflow-x-auto pb-4"
    >
      {sorted.map((col) => {
        const colTasks = tasksOf(col.id);
        const wipOver = col.wipLimit != null && colTasks.length > col.wipLimit;
        const isColDropTarget = dragColId && overColDrag === col.id && dragColId !== col.id;
        const isCardTarget = Boolean(dragId) && over?.colId === col.id;
        // Карточки колонки без перетаскиваемой + позиция прозрачного слота:
        // ровно то место, куда карточка встанет после отпускания
        const visible = tasksWithoutDragged(col.id);
        const slot = isCardTarget ? dropSlotIndex(col, visible, over!.index) : -1;
        // Колонка окрашена своим цветом: заметно выделяется на фоне страницы
        // (в т.ч. на цветном фоне проекта) и сразу читается как отдельный список
        const tint = wipOver ? "#ef4444" : col.color;
        const highlight = isCardTarget || isColDropTarget;
        return (
          <div
            key={col.id}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragColId) {
                setOverColDrag(col.id);
              } else if (dragId) {
                // Над пустым местом колонки позиция не сбрасывается в конец:
                // держим ту, что показали над карточками. В конец — только при
                // заходе в другую колонку.
                setOver((prev) =>
                  prev && prev.colId === col.id
                    ? prev
                    : { colId: col.id, index: tasksWithoutDragged(col.id).length }
                );
              }
            }}
            onDragLeave={(e) => {
              // Переход между карточками внутри колонки — это тоже dragleave;
              // сбрасываем, только когда курсор реально покинул колонку
              if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
              setOver((prev) => (prev?.colId === col.id ? null : prev));
              setOverColDrag((c) => (c === col.id ? null : c));
            }}
            onDrop={() => (dragColId ? dropColumn(col.id) : dropCard(col))}
            className={`flex w-[85vw] max-w-[20rem] shrink-0 flex-col rounded-2xl border transition sm:w-80 ${
              isColDropTarget ? "border-dashed" : ""
            }`}
            // Каждая граница — отдельным свойством: смешивать сокращённое
            // borderColor с borderTopColor нельзя, React обновляет их
            // независимо и верхняя полоса «залипает» от прошлого состояния
            style={{
              backgroundColor: `color-mix(in srgb, ${tint} 18%, var(--surface))`,
              borderTopColor: highlight ? "var(--accent)" : tint,
              borderRightColor: highlight ? "var(--accent)" : tint + "80",
              borderBottomColor: highlight ? "var(--accent)" : tint + "80",
              borderLeftColor: highlight ? "var(--accent)" : tint + "80",
              borderTopWidth: 3,
            }}
          >
            <div
              className="flex items-center gap-2 rounded-t-xl px-4 py-3"
              style={{ backgroundColor: `color-mix(in srgb, ${tint} 16%, transparent)` }}
            >
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
                data-tip="Перетащите, чтобы переставить колонку"
                className="cursor-grab text-muted/60 transition hover:text-foreground active:cursor-grabbing"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M7 4a1 1 0 110 2 1 1 0 010-2zM7 9a1 1 0 110 2 1 1 0 010-2zM7 14a1 1 0 110 2 1 1 0 010-2zM13 4a1 1 0 110 2 1 1 0 010-2zM13 9a1 1 0 110 2 1 1 0 010-2zM13 14a1 1 0 110 2 1 1 0 010-2z" />
                </svg>
              </span>
              <span
                aria-hidden
                className="block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: col.color }}
              />
              <div className="min-w-0 flex-1">
                <ColumnTitle name={col.name} onRename={(n) => renameColumn(col.id, n)} />
              </div>
              <WipBadge count={colTasks.length} limit={col.wipLimit} />
              <button
                type="button"
                data-tip="Настроить колонку"
                aria-label={`Настроить колонку «${col.name}»`}
                onClick={(e) => toggleEditor(col.id, e)}
                className="shrink-0 rounded p-0.5 text-muted transition hover:bg-surface-2 hover:text-foreground"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                </svg>
              </button>
              {editorFor === col.id && editorRect && (
                <ColumnEditor
                  column={col}
                  anchorRect={editorRect}
                  canDelete={canManageBoard && columns.length > 1}
                  canHide={sorted.length > 1}
                  onSave={(fields) => saveColumn(col.id, fields)}
                  onHide={() => setColumnHidden(col.id, true)}
                  onDelete={() => setColToRemove(col)}
                  onClose={() => setEditorFor(null)}
                />
              )}
            </div>

            {/* Тело колонки листается протяжкой по вертикали, а при переносе
                карточки к её краю — подкручивается само (см. useDragScroll) */}
            <DragScroll axis="y" className="flex-1 space-y-2.5 overflow-y-auto pt-1.5 px-3 pb-3">
              {/* Перетаскиваемая карточка остаётся в разметке, но скрыта
                  (display:none): на её месте слот, а обработчик dragEnd жив —
                  иначе отмена переноса оставила бы доску без этой карточки */}
              {renderList(col, visible, slot).map(({ task: t, index: i, ghost }) => (
                <Fragment key={t.id}>
                  {i === slot && !ghost && <DropSlot height={dragHeight} />}
                <div
                  hidden={ghost}
                  draggable
                  role="button"
                  tabIndex={0}
                  aria-label={`${projectKey}-${t.number}: ${t.title}`}
                  onDragStart={(e) => {
                    // Firefox не начинает перенос без данных в dataTransfer
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", t.id);
                    // Состояние здесь не трогаем: dragstart — дискретное событие,
                    // React применил бы setState синхронно, карточка исчезла бы
                    // прямо в момент старта и браузер отменил бы перенос.
                    // Слот повторяет размер карточки — соседи не «прыгают».
                    dragMeta.current = { id: t.id, height: e.currentTarget.offsetHeight };
                  }}
                  onDrag={() => {
                    // Первый drag — перенос уже точно начался, прятать источник
                    // безопасно (дальше срабатывает только один раз)
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
                  onDragOver={(e) => hoverCard(col.id, i, e)}
                  onClick={() => router.push(`/tasks/${t.id}`)}
                  onKeyDown={(e) => {
                    // Клавиши обрабатываем только когда фокус на самой карточке,
                    // а не на вложенных кнопках (галочка, палитра).
                    if (e.target !== e.currentTarget) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/tasks/${t.id}`);
                    } else if (e.key.toLowerCase() === "d") {
                      e.preventDefault();
                      toggleTaskDone(t);
                    }
                  }}
                  // Выполненные карточки приглушены (блёклый цвет и полупрозрачность),
                  // при наведении проявляются — сразу видно, что уже сделано
                  className={`group cursor-pointer rounded-xl border border-edge bg-surface p-3.5 outline-none transition hover:border-accent/50 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40 ${
                    t.status === "DONE" || t.status === "CLOSED"
                      ? "opacity-55 saturate-50 hover:opacity-100 hover:saturate-100 focus-visible:opacity-100"
                      : ""
                  }`}
                  style={
                    t.color
                      ? { backgroundColor: t.color + "1f", borderColor: t.color + "66" }
                      : undefined
                  }
                >
                  <div className="mb-2 flex items-center gap-2">
                    {(() => {
                      const isDone = t.status === "DONE" || t.status === "CLOSED";
                      return (
                        <button
                          type="button"
                          data-tip={isDone ? "Снять отметку «Готово»" : "Отметить выполненной"}
                          aria-label={isDone ? "Снять отметку «Готово»" : "Отметить выполненной"}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTaskDone(t);
                          }}
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
                            isDone
                              ? "border-green-500 bg-green-500 text-white"
                              : "border-edge text-transparent opacity-0 hover:border-green-500 hover:text-green-500 group-hover:opacity-100 focus-visible:opacity-100"
                          }`}
                        >
                          <svg className="h-3 w-3" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 10.5l3.5 3.5L15 6.5" />
                          </svg>
                        </button>
                      );
                    })()}
                    <span className="font-mono text-[11px] font-semibold text-muted">
                      {projectKey}-{t.number}
                    </span>
                    <TypeBadge type={t.type} />
                    <span
                      className="relative ml-auto flex items-center gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        data-tip="Цвет карточки"
                        onClick={(e) => togglePalette(t.id, e)}
                        className="h-3.5 w-3.5 rounded-full border border-edge opacity-0 transition group-hover:opacity-100"
                        style={{ backgroundColor: t.color ?? "transparent" }}
                      >
                        {!t.color && (
                          <svg className="h-full w-full text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                          </svg>
                        )}
                      </button>
                      {paletteFor === t.id && paletteRect && (
                        <ColorPalette
                          allowReset
                          anchorRect={paletteRect}
                          onPick={(c) => recolorTask(t.id, c)}
                          onClose={() => setPaletteFor(null)}
                        />
                      )}
                      <PriorityBadge priority={t.priority} />
                    </span>
                  </div>
                  <p
                    className={`mb-2.5 text-sm font-medium leading-snug ${
                      t.status === "DONE" || t.status === "CLOSED"
                        ? "text-muted line-through decoration-muted/60"
                        : ""
                    }`}
                  >
                    {t.title}
                  </p>
                  {t.tags.length > 0 && (
                    <div className="mb-2.5">
                      <TagChips tags={t.tags} small />
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-[11px] text-muted">
                    <AssigneeAvatars assignees={t.assignees} />
                    {/* Подзадачи и чек-лист — «выполнено из всего»:
                        прогресс карточки виден без её открытия */}
                    {t.childrenCount > 0 && (
                      <span
                        data-tip={`Подзадачи: выполнено ${t.childrenDoneCount} из ${t.childrenCount}`}
                        className={`flex items-center gap-0.5 tabular-nums ${
                          t.childrenDoneCount === t.childrenCount ? "text-emerald-400" : ""
                        }`}
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                        </svg>
                        {t.childrenDoneCount}/{t.childrenCount}
                      </span>
                    )}
                    {t.checklistCount > 0 && (
                      <span
                        data-tip={`Чек-лист: отмечено ${t.checklistDoneCount} из ${t.checklistCount}`}
                        className={`flex items-center gap-0.5 tabular-nums ${
                          t.checklistDoneCount === t.checklistCount ? "text-emerald-400" : ""
                        }`}
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75h11.25M9 12h11.25M9 17.25h11.25M3.75 6.4l1.2 1.2 2-2.6M3.75 11.65l1.2 1.2 2-2.6M3.75 16.9l1.2 1.2 2-2.6" />
                        </svg>
                        {t.checklistDoneCount}/{t.checklistCount}
                      </span>
                    )}
                    {t.patchLogCount > 0 && (
                      <span data-tip="Патч-логи" className="flex items-center gap-0.5">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        {t.patchLogCount}
                      </span>
                    )}
                    {t.spentHours > 0 && (
                      <span data-tip="Затрачено времени" className="flex items-center gap-0.5">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {formatHours(t.spentHours)}
                      </span>
                    )}
                    {t.dueDate && <span className="ml-auto">{formatDate(t.dueDate)}</span>}
                  </div>
                </div>
                </Fragment>
              ))}
              {slot === visible.length && <DropSlot height={dragHeight} />}
              {visible.length === 0 && slot < 0 && (
                <div className="rounded-xl border border-dashed border-edge/60 py-8 text-center text-xs text-muted/60">
                  Перетащите задачу сюда
                </div>
              )}
            </DragScroll>

            {/* Создание задачи прямо в колонке: неброская строка внизу,
                как в Trello — задача сразу попадает в эту колонку */}
            <div className="px-3 pb-3">
              <NewTaskDialog
                projectId={projectId}
                columnId={col.id}
                tasks={tasks}
                members={members}
                templates={templates}
                projectTags={projectTags}
                triggerLabel={
                  <>
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Задача
                  </>
                }
                triggerClassName="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-foreground"
              />
            </div>
          </div>
        );
      })}

      <AddColumn onCreate={createColumn} />

      {/* Скрытые колонки: доска о них помнит — вернуть можно в один клик */}
      {hiddenColumns.length > 0 && (
        <div className="flex h-fit w-60 shrink-0 flex-col gap-2 rounded-2xl border border-dashed border-edge/80 p-4">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
            </svg>
            Скрытые ({hiddenColumns.length})
          </h3>
          {hiddenColumns.map((col) => {
            const count = tasks.filter((t) => t.columnId === col.id).length;
            return (
              <div
                key={col.id}
                className="flex items-center gap-2 rounded-lg border border-edge bg-surface/60 px-2.5 py-2"
              >
                <span
                  aria-hidden
                  className="block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: col.color }}
                />
                <span className="min-w-0 flex-1 truncate text-sm">{col.name}</span>
                <span className="shrink-0 text-[11px] text-muted">{count}</span>
                <button
                  type="button"
                  onClick={() => setColumnHidden(col.id, false)}
                  data-tip={`Вернуть колонку «${col.name}» на доску`}
                  aria-label={`Показать колонку «${col.name}»`}
                  className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-accent-hover transition hover:bg-surface-2"
                >
                  Показать
                </button>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={colToRemove !== null}
        title={`Удалить колонку «${colToRemove?.name ?? ""}»?`}
        message="Задачи не пропадут — они переедут в первую колонку доски. Статусы задач не изменятся."
        confirmLabel="Удалить колонку"
        onConfirm={() => colToRemove && removeColumn(colToRemove.id)}
        onCancel={() => setColToRemove(null)}
      />
    </div>
  );
}
