"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import type { KanbanColumn, KanbanLabels } from "@/components/ui/kanban/Kanban";
import type { KanbanSort } from "@/components/ui/kanban/kanbanOrder";

/** Размеры поповера — по ним считается, поместится ли он под кнопкой. */
const EDITOR_W = 264;
const EDITOR_H = 420;

export interface ColumnEditorProps {
  column: KanbanColumn;
  /** Прямоугольник кнопки-триггера: относительно него встаёт поповер. */
  anchorRect: DOMRect;
  palette: readonly string[];
  labels: KanbanLabels;
  canDelete: boolean;
  canHide: boolean;
  onSave: (fields: {
    name: string;
    color: string;
    wipLimit: number | null;
    sort: KanbanSort;
  }) => void;
  onHide: () => void;
  onDelete: () => void;
  onClose: () => void;
}

/**
 * Настройки колонки одним поповером: название, цвет, WIP-лимит, порядок
 * карточек, скрытие и удаление.
 *
 * Позиционируется через fixed и портал в body — иначе поповер обрезался бы
 * колонкой, у которой overflow, и «переворот» вверх при нехватке места
 * внизу экрана был бы не виден.
 */
export function ColumnEditor({
  column,
  anchorRect,
  palette,
  labels,
  canDelete,
  canHide,
  onSave,
  onHide,
  onDelete,
  onClose,
}: ColumnEditorProps) {
  const [name, setName] = useState(column.name);
  const [color, setColor] = useState(column.color);
  const [wip, setWip] = useState(column.wipLimit != null ? String(column.wipLimit) : "");
  const [sort, setSort] = useState<KanbanSort>(column.sort ?? "MANUAL");

  const gap = 6;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.min(Math.max(8, anchorRect.right - EDITOR_W), vw - EDITOR_W - 8);
  let top = anchorRect.bottom + gap;
  if (top + EDITOR_H > vh - 8) {
    const above = anchorRect.top - gap - EDITOR_H;
    top = above >= 8 ? above : Math.max(8, vh - EDITOR_H - 8);
  }

  const SORT_LABELS: Record<KanbanSort, string> = {
    MANUAL: labels.sortManual ?? "Manual (drag to reorder)",
    CREATED_DESC: labels.sortNewest ?? "Newest first",
    CREATED_ASC: labels.sortOldest ?? "Oldest first",
  };

  function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const parsed = parseInt(wip, 10);
    onSave({
      name: trimmed,
      color,
      // Ноль и отрицательное — не лимит, а «без лимита»: иначе колонка
      // краснела бы всегда
      wipLimit: Number.isFinite(parsed) && parsed > 0 ? parsed : null,
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
          <span className="mb-1 block text-[11px] text-muted">
            {labels.columnName ?? "Name"}
          </span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-edge bg-surface-2 px-2.5 py-1.5 text-sm outline-none transition focus:border-accent"
          />
        </label>

        <span className="mb-1 block text-[11px] text-muted">{labels.color ?? "Color"}</span>
        <div className="mb-3 flex flex-wrap gap-1.5">
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

        <label className="mb-3 block">
          <span className="mb-1 block text-[11px] text-muted">
            {labels.wipLimit ?? "WIP limit"}{" "}
            <span className="opacity-70">· {labels.wipLimitHint ?? "empty means no limit"}</span>
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
          <span className="mb-1 block text-[11px] text-muted">
            {labels.cardOrder ?? "Card order"}
          </span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as KanbanSort)}
            className="w-full rounded-lg border border-edge bg-surface-2 px-2.5 py-1.5 text-sm outline-none transition focus:border-accent"
          >
            {(Object.keys(SORT_LABELS) as KanbanSort[]).map((s) => (
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
            className="flex-1 rounded-lg bg-accent py-1.5 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-50"
          >
            {labels.save ?? "Save"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-edge px-3 py-1.5 text-sm text-muted transition hover:text-foreground"
          >
            {labels.cancel ?? "Cancel"}
          </button>
        </div>

        {canHide && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onHide();
            }}
            className="mt-2.5 w-full rounded-lg border border-edge py-1.5 text-xs font-medium text-muted transition hover:bg-surface-2 hover:text-foreground"
          >
            {labels.hide ?? "Hide column"}
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
            {labels.delete ?? "Delete column"}
          </button>
        )}
      </div>
    </>,
    document.body
  );
}
