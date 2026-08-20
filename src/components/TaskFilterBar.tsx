"use client";

import { useState, useTransition } from "react";
import type { TaskStatus, TaskType, Priority } from "@prisma/client";
import type { MemberDTO, TagDTO } from "@/lib/types";
import { PRIORITY_LABELS, STATUS_LABELS, TYPE_LABELS } from "@/lib/labels";
import { saveFilterAction, deleteFilterAction } from "@/lib/actions/filters";
import {
  EMPTY_FILTER,
  isFilterActive,
  parseTaskFilter,
  serializeTaskFilter,
  type TaskFilter,
} from "@/lib/taskFilter";

export interface SavedFilterDTO {
  id: string;
  name: string;
  query: string;
}

const selectCls =
  "rounded-lg border border-edge bg-surface-2 px-2.5 py-1.5 text-sm outline-none focus:border-accent";

/**
 * Панель фильтров задач — одна на список и на доску, поэтому фильтр,
 * сохранённый в одном представлении, применяется и в другом.
 */
export function TaskFilterBar({
  filter,
  onChange,
  members,
  projectTags,
  projectId,
  savedFilters = [],
  matchedCount,
  totalCount,
  compact,
}: {
  filter: TaskFilter;
  onChange: (next: TaskFilter) => void;
  members: MemberDTO[];
  projectTags: TagDTO[];
  projectId: string;
  savedFilters?: SavedFilterDTO[];
  matchedCount: number;
  totalCount: number;
  /** На доске панель уже — статус там задаёт сама колонка. */
  compact?: boolean;
}) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [, startTransition] = useTransition();

  const active = isFilterActive(filter);
  const set = (patch: Partial<TaskFilter>) => onChange({ ...filter, ...patch });

  function saveCurrent() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setNaming(false);
    setName("");
    startTransition(() => saveFilterAction(projectId, trimmed, serializeTaskFilter(filter)));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={filter.q}
          onChange={(e) => set({ q: e.target.value })}
          placeholder="Поиск по названию или номеру…"
          className="w-56 rounded-lg border border-edge bg-surface-2 px-3 py-1.5 text-sm outline-none focus:border-accent"
        />

        {/* На доске статус читается по колонке — селект только в списке */}
        {!compact && (
          <select
            value={filter.status}
            onChange={(e) => set({ status: e.target.value as TaskStatus | "ALL" })}
            className={selectCls}
          >
            <option value="ALL">Все статусы</option>
            {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        )}

        <select
          value={filter.type}
          onChange={(e) => set({ type: e.target.value as TaskType | "ALL" })}
          className={selectCls}
        >
          <option value="ALL">Все типы</option>
          {(Object.keys(TYPE_LABELS) as TaskType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>

        <select
          value={filter.priority}
          onChange={(e) => set({ priority: e.target.value as Priority | "ALL" })}
          className={selectCls}
        >
          <option value="ALL">Любой приоритет</option>
          {(Object.keys(PRIORITY_LABELS) as Priority[]).map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>

        <select
          value={filter.assignee}
          onChange={(e) => set({ assignee: e.target.value })}
          className={selectCls}
        >
          <option value="ALL">Все исполнители</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>

        {projectTags.length > 0 && (
          <select
            value={filter.tag}
            onChange={(e) => set({ tag: e.target.value })}
            className={selectCls}
          >
            <option value="ALL">Все метки</option>
            {projectTags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}

        {active && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTER)}
            className="rounded-lg border border-edge px-2.5 py-1.5 text-sm text-muted transition hover:bg-surface-2 hover:text-foreground"
          >
            Сбросить
          </button>
        )}

        {naming ? (
          <span className="flex items-center gap-1.5">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveCurrent();
                if (e.key === "Escape") setNaming(false);
              }}
              placeholder="Название фильтра"
              className="w-40 rounded-lg border border-accent bg-surface-2 px-3 py-1.5 text-sm outline-none"
            />
            <button
              type="button"
              onClick={saveCurrent}
              disabled={!name.trim()}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold transition hover:bg-accent-hover disabled:opacity-50"
            >
              ОК
            </button>
            <button
              type="button"
              onClick={() => setNaming(false)}
              className="rounded-lg border border-edge px-2.5 py-1.5 text-sm text-muted transition hover:text-foreground"
            >
              ✕
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setNaming(true)}
            disabled={!active}
            data-tip={active ? "Сохранить текущие фильтры" : "Задайте фильтры, чтобы сохранить"}
            className="rounded-lg border border-edge px-3 py-1.5 text-sm text-muted transition hover:bg-surface-2 hover:text-foreground disabled:opacity-40"
          >
            ★ Сохранить
          </button>
        )}

        <span className="ml-auto text-xs text-muted">
          {active ? `${matchedCount} из ${totalCount}` : `${totalCount} задач`}
        </span>
      </div>

      {savedFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">Сохранённые:</span>
          {savedFilters.map((f) => (
            <span
              key={f.id}
              className="flex items-center gap-1 rounded-full border border-edge bg-surface-2 px-2.5 py-1 text-xs"
            >
              <button
                type="button"
                onClick={() => onChange(parseTaskFilter(f.query))}
                className="transition hover:text-accent-hover"
              >
                {f.name}
              </button>
              <button
                type="button"
                data-tip="Удалить фильтр"
                onClick={() => startTransition(() => deleteFilterAction(f.id))}
                className="text-muted/60 transition hover:text-red-400"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
