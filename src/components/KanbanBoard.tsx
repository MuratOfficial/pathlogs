"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { TaskDTO, ColumnDTO } from "@/lib/types";
import {
  createBoardColumnAction,
  updateBoardColumnAction,
  deleteBoardColumnAction,
  moveTaskAction,
  reorderColumnsAction,
  updateTaskColorAction,
} from "@/lib/actions/board";
import { updateTaskStatusAction } from "@/lib/actions/tasks";
import { BOARD_PALETTE, formatDate, formatHours } from "@/lib/labels";
import { AssigneeAvatars, PriorityDot, TypeBadge } from "./TaskBadges";

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

/** Бейдж количества карточек с WIP-лимитом. Клик (для управляющих) — задать лимит. */
function WipBadge({
  count,
  limit,
  canEdit,
  onSetLimit,
}: {
  count: number;
  limit: number | null;
  canEdit: boolean;
  onSetLimit: (limit: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(limit ? String(limit) : "");
  const over = limit != null && count > limit;

  if (editing) {
    function commit() {
      setEditing(false);
      const n = parseInt(value, 10);
      onSetLimit(Number.isFinite(n) && n > 0 ? n : null);
    }
    return (
      <input
        autoFocus
        type="number"
        min={1}
        value={value}
        placeholder="∞"
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        className="w-14 rounded-full border border-accent bg-surface-2 px-2 py-0.5 text-center text-xs outline-none"
        data-tip="WIP-лимит колонки (пусто — без лимита)"
      />
    );
  }

  return (
    <span
      onClick={canEdit ? () => { setValue(limit ? String(limit) : ""); setEditing(true); } : undefined}
      data-tip={
        canEdit
          ? "Нажмите, чтобы задать WIP-лимит"
          : limit != null
            ? `WIP-лимит: ${limit}`
            : undefined
      }
      className={`rounded-full px-2 py-0.5 text-xs ${canEdit ? "cursor-pointer" : ""} ${
        over
          ? "bg-red-500/20 font-semibold text-red-400"
          : "bg-surface-2 text-muted"
      }`}
    >
      {limit != null ? `${count}/${limit}` : count}
    </span>
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
}: {
  tasks: TaskDTO[];
  columns: ColumnDTO[];
  projectId: string;
  projectKey: string;
  /** Право удалять колонки (менеджер проекта, владелец или админ). */
  canManageBoard: boolean;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [columns, setColumns] = useState(initialColumns);

  // После ревалидации сервер присылает свежие props — сбрасываем локальное
  // (оптимистичное) состояние на серверную правду прямо во время рендера.
  const [prevTasks, setPrevTasks] = useState(initialTasks);
  if (initialTasks !== prevTasks) {
    setPrevTasks(initialTasks);
    setTasks(initialTasks);
  }
  const [prevColumns, setPrevColumns] = useState(initialColumns);
  if (initialColumns !== prevColumns) {
    setPrevColumns(initialColumns);
    setColumns(initialColumns);
  }

  const [dragId, setDragId] = useState<string | null>(null); // перетаскиваемая карточка
  const [overTaskId, setOverTaskId] = useState<string | null>(null); // карточка-цель (вставить перед ней)
  const [overCol, setOverCol] = useState<string | null>(null); // колонка-цель для карточки
  const [dragColId, setDragColId] = useState<string | null>(null); // перетаскиваемая колонка
  const [overColDrag, setOverColDrag] = useState<string | null>(null); // колонка-цель при переносе колонки
  const [paletteFor, setPaletteFor] = useState<string | null>(null); // id колонки или задачи
  const [paletteRect, setPaletteRect] = useState<DOMRect | null>(null); // якорь палитры
  const [, startTransition] = useTransition();

  // Открыть/закрыть палитру, запомнив позицию кнопки-триггера
  function togglePalette(id: string, e: React.MouseEvent<HTMLButtonElement>) {
    if (paletteFor === id) {
      setPaletteFor(null);
    } else {
      setPaletteRect(e.currentTarget.getBoundingClientRect());
      setPaletteFor(id);
    }
  }

  const sorted = [...columns].sort((a, b) => a.order - b.order);

  function columnOf(t: TaskDTO): string | null {
    if (t.columnId && columns.some((c) => c.id === t.columnId)) return t.columnId;
    if (t.status === "CLOSED" || t.status === "ARCHIVED") return null;
    return columns.find((c) => c.status === t.status)?.id ?? null;
  }

  function tasksOf(colId: string): TaskDTO[] {
    return tasks
      .filter((t) => columnOf(t) === colId)
      .sort((a, b) => a.order - b.order);
  }

  // ── Перенос карточки ──────────────────────────────────────────────
  function dropCard(col: ColumnDTO) {
    const id = dragId;
    if (!id) return;
    const list = tasksOf(col.id).filter((t) => t.id !== id);
    let insertIndex = list.length;
    if (overTaskId && overTaskId !== id) {
      const idx = list.findIndex((t) => t.id === overTaskId);
      if (idx >= 0) insertIndex = idx;
    }
    const newIds = list.map((t) => t.id);
    newIds.splice(insertIndex, 0, id);

    setDragId(null);
    setOverTaskId(null);
    setOverCol(null);
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

  function recolorColumn(colId: string, color: string | null) {
    if (!color) return;
    setColumns((prev) => prev.map((c) => (c.id === colId ? { ...c, color } : c)));
    startTransition(() => updateBoardColumnAction(colId, { color }));
  }

  function renameColumn(colId: string, name: string) {
    setColumns((prev) => prev.map((c) => (c.id === colId ? { ...c, name } : c)));
    startTransition(() => updateBoardColumnAction(colId, { name }));
  }

  function setColumnWip(colId: string, wipLimit: number | null) {
    setColumns((prev) => prev.map((c) => (c.id === colId ? { ...c, wipLimit } : c)));
    startTransition(() => updateBoardColumnAction(colId, { wipLimit }));
  }

  function removeColumn(colId: string) {
    setColumns((prev) => prev.filter((c) => c.id !== colId));
    setTasks((prev) =>
      prev.map((t) => (t.columnId === colId ? { ...t, columnId: null } : t))
    );
    startTransition(() => deleteBoardColumnAction(colId));
  }

  function recolorTask(taskId: string, color: string | null) {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, color } : t)));
    startTransition(() => updateTaskColorAction(taskId, color));
  }

  // Быстрая отметка «Готово» по клику на галочку (как в Trello).
  // Повторный клик снимает отметку и возвращает в «К выполнению».
  function toggleTaskDone(t: TaskDTO) {
    const isDone = t.status === "DONE" || t.status === "CLOSED";
    const next = isDone ? "TODO" : "DONE";
    const targetCol = columns.find((c) => c.status === next) ?? null;
    setTasks((prev) =>
      prev.map((x) =>
        x.id === t.id
          ? { ...x, status: next, columnId: targetCol?.id ?? x.columnId }
          : x
      )
    );
    startTransition(() => updateTaskStatusAction(t.id, next));
  }

  return (
    <div className="flex h-full gap-4 overflow-x-auto pb-4">
      {sorted.map((col) => {
        const colTasks = tasksOf(col.id);
        const wipOver = col.wipLimit != null && colTasks.length > col.wipLimit;
        const isColDropTarget = dragColId && overColDrag === col.id && dragColId !== col.id;
        return (
          <div
            key={col.id}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragColId) setOverColDrag(col.id);
              else {
                setOverCol(col.id);
                setOverTaskId(null); // над пустым местом колонки — в конец
              }
            }}
            onDragLeave={() => {
              setOverCol((c) => (c === col.id ? null : c));
              setOverColDrag((c) => (c === col.id ? null : c));
            }}
            onDrop={() => (dragColId ? dropColumn(col.id) : dropCard(col))}
            className={`flex w-80 shrink-0 flex-col rounded-2xl border bg-surface/60 transition ${
              overCol === col.id && !dragColId
                ? "border-accent/60 bg-accent/5"
                : isColDropTarget
                  ? "border-accent border-dashed"
                  : wipOver
                    ? "border-red-500/50 bg-red-500/[0.04]"
                    : "border-edge"
            }`}
            style={
              overCol === col.id && !dragColId
                ? undefined
                : {
                    borderTopColor: (wipOver ? "#ef4444" : col.color) + "99",
                    borderTopWidth: 2,
                  }
            }
          >
            <div className="flex items-center gap-2 px-4 py-3">
              <span
                draggable
                onDragStart={(e) => {
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
              <span className="relative">
                <button
                  type="button"
                  data-tip="Цвет колонки"
                  onClick={(e) => togglePalette(col.id, e)}
                  className="block h-2.5 w-2.5 rounded-full transition hover:scale-125"
                  style={{ backgroundColor: col.color }}
                />
                {paletteFor === col.id && paletteRect && (
                  <ColorPalette
                    anchorRect={paletteRect}
                    onPick={(c) => recolorColumn(col.id, c)}
                    onClose={() => setPaletteFor(null)}
                  />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <ColumnTitle name={col.name} onRename={(n) => renameColumn(col.id, n)} />
              </div>
              <WipBadge
                count={colTasks.length}
                limit={col.wipLimit}
                canEdit={canManageBoard}
                onSetLimit={(l) => setColumnWip(col.id, l)}
              />
              {!col.status && canManageBoard && (
                <button
                  type="button"
                  data-tip="Удалить колонку (задачи вернутся в колонки статусов)"
                  onClick={() => removeColumn(col.id)}
                  className="text-muted transition hover:text-red-400"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            <div className="flex-1 space-y-2.5 overflow-y-auto px-3 pb-3">
              {colTasks.map((t) => (
                <div
                  key={t.id}
                  draggable
                  onDragStart={() => setDragId(t.id)}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverTaskId(null);
                    setOverCol(null);
                  }}
                  onDragOver={(e) => {
                    if (!dragId) return;
                    e.preventDefault();
                    e.stopPropagation();
                    setOverCol(col.id);
                    setOverTaskId(t.id);
                  }}
                  onClick={() => router.push(`/tasks/${t.id}`)}
                  className={`group cursor-pointer rounded-xl border border-edge bg-surface p-3.5 transition hover:border-accent/50 ${
                    dragId === t.id ? "opacity-40" : ""
                  } ${
                    overTaskId === t.id && dragId && dragId !== t.id
                      ? "border-t-2 border-t-accent"
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
                      <PriorityDot priority={t.priority} />
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
                  <div className="flex items-center gap-2 text-[11px] text-muted">
                    <AssigneeAvatars assignees={t.assignees} />
                    {t.childrenCount > 0 && (
                      <span data-tip="Подзадачи" className="flex items-center gap-0.5">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                        </svg>
                        {t.childrenCount}
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
              ))}
              {colTasks.length === 0 && (
                <div className="rounded-xl border border-dashed border-edge/60 py-8 text-center text-xs text-muted/60">
                  Перетащите задачу сюда
                </div>
              )}
            </div>
          </div>
        );
      })}

      <AddColumn onCreate={createColumn} />
    </div>
  );
}
