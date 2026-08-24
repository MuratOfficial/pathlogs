"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog } from "@toimetdev/pathlogs-core";
import {
  ANY,
  activeFieldCount,
  emptyFilter,
  isFilterActive,
  parseFilter,
  serializeFilter,
  type FilterField,
  type FilterState,
} from "@/components/ui/filter-bar/filterModel";

export interface SavedFilter {
  id: string;
  name: string;
  /** Строка запроса — то же, что отдаёт serializeFilter. */
  query: string;
}

export interface FilterBarLabels {
  reset?: string;
  save?: string;
  saveTitle?: string;
  savePrompt?: string;
  presets?: string;
  deletePreset?: string;
  deleteTitle?: string;
  deleteMessage?: string;
  matched?: string;
  cancel?: string;
}

export interface FilterBarProps<T> {
  fields: FilterField<T>[];
  value: FilterState;
  onChange: (next: FilterState) => void;

  /** Сохранённые пресеты. Без обработчиков они только применяются. */
  savedFilters?: SavedFilter[];
  onSaveFilter?: (name: string, query: string) => void | Promise<unknown>;
  onDeleteFilter?: (id: string) => void | Promise<unknown>;

  /** Сколько элементов прошло отбор и сколько всего — подпись под панелью. */
  matchedCount?: number;
  totalCount?: number;

  /** Плотная раскладка: панель встраивается в шапку, а не стоит отдельно. */
  compact?: boolean;
  labels?: FilterBarLabels;
}

/**
 * Панель фильтров, собираемая из описания полей.
 *
 * Что фильтровать, панель не знает — знает `fields`. Поэтому один и тот же
 * компонент обслуживает задачи, заявки и что угодно ещё, а новое условие
 * добавляется записью в массиве, а не правкой этого файла.
 *
 * Разбор, сборка и сам отбор живут в ./filterModel.ts — там же их тесты.
 */
export function FilterBar<T>({
  fields,
  value,
  onChange,
  savedFilters = [],
  onSaveFilter,
  onDeleteFilter,
  matchedCount,
  totalCount,
  compact = false,
  labels = {},
}: FilterBarProps<T>) {
  const [, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [toDelete, setToDelete] = useState<SavedFilter | null>(null);

  const active = isFilterActive(fields, value);
  const count = activeFieldCount(fields, value);

  function set(key: string, next: string) {
    onChange({ ...value, [key]: next });
  }

  function reset() {
    onChange(emptyFilter(fields));
  }

  function save() {
    const trimmed = name.trim();
    if (!trimmed || !onSaveFilter) return;
    const query = serializeFilter(fields, value);
    setName("");
    setSaving(false);
    startTransition(async () => {
      await onSaveFilter(trimmed, query);
    });
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className={`flex flex-wrap items-end gap-2 ${compact ? "text-xs" : "text-sm"}`}>
        {fields.map((field) => (
          <label key={field.key} className="flex min-w-0 flex-col gap-1">
            <span className="text-[11px] font-medium text-muted">{field.label}</span>

            {field.kind === "text" ? (
              <input
                value={value[field.key] ?? ""}
                onChange={(e) => set(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="w-44 rounded-lg border border-edge bg-surface-2 px-2.5 py-1.5 text-sm outline-none transition focus:border-accent"
              />
            ) : (
              <select
                value={value[field.key] ?? ANY}
                onChange={(e) => set(field.key, e.target.value)}
                className="rounded-lg border border-edge bg-surface-2 px-2.5 py-1.5 text-sm outline-none transition focus:border-accent"
              >
                <option value={ANY}>{field.anyLabel ?? "Any"}</option>
                {field.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
          </label>
        ))}

        {active && (
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border border-edge px-2.5 py-1.5 text-xs text-muted transition hover:bg-surface-2 hover:text-foreground"
          >
            {labels.reset ?? "Reset"}
            <span className="ml-1 tabular-nums opacity-70">{count}</span>
          </button>
        )}

        {active && onSaveFilter && (
          <button
            type="button"
            onClick={() => setSaving(true)}
            className="rounded-lg border border-accent/50 px-2.5 py-1.5 text-xs font-medium text-accent-hover transition hover:bg-accent/10"
          >
            {labels.save ?? "Save filter"}
          </button>
        )}
      </div>

      {savedFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted">{labels.presets ?? "Saved"}:</span>
          {savedFilters.map((preset) => (
            <span
              key={preset.id}
              className="flex items-center gap-1 rounded-full border border-edge bg-surface-2 pl-2.5 transition hover:border-accent/50"
            >
              <button
                type="button"
                onClick={() => onChange(parseFilter(fields, preset.query))}
                className="py-1 text-muted transition hover:text-foreground"
              >
                {preset.name}
              </button>
              {onDeleteFilter && (
                <button
                  type="button"
                  onClick={() => setToDelete(preset)}
                  aria-label={`${labels.deletePreset ?? "Delete preset"}: ${preset.name}`}
                  className="px-1.5 py-1 text-muted/60 transition hover:text-red-400"
                >
                  ✕
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {matchedCount !== undefined && totalCount !== undefined && active && (
        <p className="text-xs tabular-nums text-muted">
          {(labels.matched ?? "{matched} of {total}")
            .replace("{matched}", String(matchedCount))
            .replace("{total}", String(totalCount))}
        </p>
      )}

      {saving && (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setSaving(false);
            }}
            placeholder={labels.savePrompt ?? "Filter name"}
            className="w-48 rounded-lg border border-edge bg-surface-2 px-2.5 py-1.5 text-sm outline-none transition focus:border-accent"
          />
          <button
            type="button"
            onClick={save}
            disabled={!name.trim()}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-accent-hover disabled:opacity-50"
          >
            {labels.save ?? "Save"}
          </button>
          <button
            type="button"
            onClick={() => setSaving(false)}
            className="rounded-lg border border-edge px-3 py-1.5 text-xs text-muted transition hover:text-foreground"
          >
            {labels.cancel ?? "Cancel"}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title={labels.deleteTitle ?? "Delete saved filter?"}
        message={toDelete ? `«${toDelete.name}»` : undefined}
        onConfirm={() => {
          const preset = toDelete;
          setToDelete(null);
          if (preset) {
            startTransition(async () => {
              await onDeleteFilter?.(preset.id);
            });
          }
        }}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
