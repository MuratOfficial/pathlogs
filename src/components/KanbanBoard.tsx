"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TaskDTO, ColumnDTO } from "@/lib/types";
import {
  createBoardColumnAction,
  updateBoardColumnAction,
  deleteBoardColumnAction,
  moveTaskToColumnAction,
  updateTaskColorAction,
} from "@/lib/actions/board";
import { BOARD_PALETTE, formatDate, formatHours } from "@/lib/labels";
import { AssigneeAvatars, PriorityDot, TypeBadge } from "./TaskBadges";

function ColorPalette({
  onPick,
  onClose,
  allowReset,
}: {
  onPick: (color: string | null) => void;
  onClose: () => void;
  allowReset?: boolean;
}) {
  return (
    <>
      <div className="fixed inset-0 z-20" onClick={onClose} />
      <div className="absolute left-0 top-full z-30 mt-1 flex w-40 flex-wrap gap-1.5 rounded-xl border border-edge bg-surface-2 p-2.5 shadow-xl">
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
            title={c}
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
            title="Сбросить цвет"
          >
            ✕
          </button>
        )}
      </div>
    </>
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

export function KanbanBoard({
  tasks: initialTasks,
  columns: initialColumns,
  projectId,
  projectKey,
}: {
  tasks: TaskDTO[];
  columns: ColumnDTO[];
  projectId: string;
  projectKey: string;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [columns, setColumns] = useState(initialColumns);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [paletteFor, setPaletteFor] = useState<string | null>(null); // id колонки или задачи
  const [, startTransition] = useTransition();

  const sorted = [...columns].sort((a, b) => a.order - b.order);

  function columnOf(t: TaskDTO): string | null {
    if (t.columnId && columns.some((c) => c.id === t.columnId)) return t.columnId;
    if (t.status === "CLOSED" || t.status === "ARCHIVED") return null;
    return columns.find((c) => c.status === t.status)?.id ?? null;
  }

  function onDrop(col: ColumnDTO) {
    if (!dragId) return;
    const id = dragId;
    setDragId(null);
    setOverCol(null);
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, columnId: col.id, status: col.status ?? t.status }
          : t
      )
    );
    startTransition(() => moveTaskToColumnAction(id, col.id));
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

  return (
    <div className="flex h-full gap-4 overflow-x-auto pb-4">
      {sorted.map((col) => {
        const colTasks = tasks.filter((t) => columnOf(t) === col.id);
        return (
          <div
            key={col.id}
            onDragOver={(e) => {
              e.preventDefault();
              setOverCol(col.id);
            }}
            onDragLeave={() => setOverCol((c) => (c === col.id ? null : c))}
            onDrop={() => onDrop(col)}
            className={`flex w-80 shrink-0 flex-col rounded-2xl border bg-surface/60 transition ${
              overCol === col.id ? "border-accent/60 bg-accent/5" : "border-edge"
            }`}
            style={overCol === col.id ? undefined : { borderTopColor: col.color + "99", borderTopWidth: 2 }}
          >
            <div className="flex items-center gap-2 px-4 py-3">
              <span className="relative">
                <button
                  type="button"
                  title="Цвет колонки"
                  onClick={() => setPaletteFor(paletteFor === col.id ? null : col.id)}
                  className="block h-2.5 w-2.5 rounded-full transition hover:scale-125"
                  style={{ backgroundColor: col.color }}
                />
                {paletteFor === col.id && (
                  <ColorPalette
                    onPick={(c) => recolorColumn(col.id, c)}
                    onClose={() => setPaletteFor(null)}
                  />
                )}
              </span>
              <h3 className="text-sm font-semibold">{col.name}</h3>
              <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">
                {colTasks.length}
              </span>
              {!col.status && (
                <button
                  type="button"
                  title="Удалить колонку (задачи вернутся в колонки статусов)"
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
                  onDragEnd={() => setDragId(null)}
                  onClick={() => router.push(`/tasks/${t.id}`)}
                  className={`group cursor-pointer rounded-xl border border-edge bg-surface p-3.5 transition hover:border-accent/50 ${
                    dragId === t.id ? "opacity-40" : ""
                  }`}
                  style={
                    t.color
                      ? { backgroundColor: t.color + "1f", borderColor: t.color + "66" }
                      : undefined
                  }
                >
                  <div className="mb-2 flex items-center gap-2">
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
                        title="Цвет карточки"
                        onClick={() => setPaletteFor(paletteFor === t.id ? null : t.id)}
                        className="h-3.5 w-3.5 rounded-full border border-edge opacity-0 transition group-hover:opacity-100"
                        style={{ backgroundColor: t.color ?? "transparent" }}
                      >
                        {!t.color && (
                          <svg className="h-full w-full text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                          </svg>
                        )}
                      </button>
                      {paletteFor === t.id && (
                        <ColorPalette
                          allowReset
                          onPick={(c) => recolorTask(t.id, c)}
                          onClose={() => setPaletteFor(null)}
                        />
                      )}
                      <PriorityDot priority={t.priority} />
                    </span>
                  </div>
                  <p className="mb-2.5 text-sm font-medium leading-snug">{t.title}</p>
                  <div className="flex items-center gap-2 text-[11px] text-muted">
                    <AssigneeAvatars assignees={t.assignees} />
                    {t.childrenCount > 0 && (
                      <span title="Подзадачи" className="flex items-center gap-0.5">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                        </svg>
                        {t.childrenCount}
                      </span>
                    )}
                    {t.patchLogCount > 0 && (
                      <span title="Патч-логи" className="flex items-center gap-0.5">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        {t.patchLogCount}
                      </span>
                    )}
                    {t.spentHours > 0 && (
                      <span title="Затрачено времени" className="flex items-center gap-0.5">
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
