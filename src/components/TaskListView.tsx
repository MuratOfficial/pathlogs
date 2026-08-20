"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { TaskDTO, MemberDTO, TagDTO } from "@/lib/types";
import {
  STATUS_COLORS,
  STATUS_LABELS,
  formatDate,
  formatHours,
} from "@/lib/labels";
import { TaskFilterBar, type SavedFilterDTO } from "./TaskFilterBar";
import { BulkActionBar } from "./BulkActionBar";
import { EMPTY_FILTER, matchesTaskFilter, type TaskFilter } from "@/lib/taskFilter";
import { AssigneeAvatars, PriorityBadge, TagChips, TypeBadge } from "./TaskBadges";

export type { SavedFilterDTO };

export function TaskListView({
  tasks,
  projectKey,
  members,
  projectId,
  savedFilters = [],
  projectTags = [],
  toolbarExtra,
}: {
  tasks: TaskDTO[];
  projectKey: string;
  members: MemberDTO[];
  projectId: string;
  savedFilters?: SavedFilterDTO[];
  projectTags?: TagDTO[];
  toolbarExtra?: React.ReactNode;
}) {
  const [filter, setFilter] = useState<TaskFilter>(EMPTY_FILTER);
  // Выбор для массовых действий. Держим id, а не индексы: список
  // перестраивается фильтром, и индексы разъехались бы.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState<string | null>(null);

  const filtered = useMemo(
    () => tasks.filter((t) => matchesTaskFilter(t, filter)),
    [tasks, filter]
  );

  // Выбранными считаем только видимые: отфильтровал — и действие не заденет
  // то, чего не видно на экране
  const visibleSelected = filtered.filter((t) => selected.has(t.id)).map((t) => t.id);
  const allVisibleSelected = filtered.length > 0 && visibleSelected.length === filtered.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allVisibleSelected ? new Set() : new Set(filtered.map((t) => t.id)));
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-edge bg-surface/60">
      <div className="border-b border-edge p-4">
        {toolbarExtra && <div className="mb-2 flex justify-end">{toolbarExtra}</div>}
        <TaskFilterBar
          filter={filter}
          onChange={setFilter}
          members={members}
          projectTags={projectTags}
          projectId={projectId}
          savedFilters={savedFilters}
          matchedCount={filtered.length}
          totalCount={tasks.length}
        />
      </div>

      {visibleSelected.length > 0 && (
        <BulkActionBar
          selectedIds={visibleSelected}
          members={members}
          projectTags={projectTags}
          onDone={(msg) => {
            setSelected(new Set());
            setNote(msg);
          }}
          onClear={() => setSelected(new Set())}
        />
      )}
      {note && (
        <div className="flex items-center gap-2 border-b border-edge bg-surface-2/60 px-4 py-2 text-xs text-muted">
          {note}
          <button
            type="button"
            onClick={() => setNote(null)}
            className="ml-auto transition hover:text-foreground"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface text-left text-xs text-muted">
            <tr>
              <th className="w-9 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAll}
                  aria-label="Выбрать все задачи в списке"
                  className="h-4 w-4 accent-[var(--accent)]"
                />
              </th>
              <th className="px-4 py-2.5 font-medium">№</th>
              <th className="px-4 py-2.5 font-medium">Задача</th>
              <th className="px-4 py-2.5 font-medium">Тип</th>
              <th className="px-4 py-2.5 font-medium">Метки</th>
              <th className="px-4 py-2.5 font-medium">Статус</th>
              <th className="px-4 py-2.5 font-medium">Исполнители</th>
              <th className="px-4 py-2.5 font-medium">Срок</th>
              <th className="px-4 py-2.5 font-medium">Время</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr
                key={t.id}
                className={`border-t border-edge/60 transition ${
                  selected.has(t.id) ? "bg-accent/10" : "hover:bg-surface-2/50"
                }`}
              >
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(t.id)}
                    onChange={() => toggle(t.id)}
                    aria-label={`Выбрать ${projectKey}-${t.number}`}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted">
                  {projectKey}-{t.number}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/tasks/${t.id}`} className="flex items-center gap-2 font-medium hover:text-accent-hover">
                    <PriorityBadge priority={t.priority} />
                    {t.title}
                  </Link>
                </td>
                <td className="px-4 py-3"><TypeBadge type={t.type} /></td>
                <td className="px-4 py-3">
                  {t.tags.length > 0 ? (
                    <TagChips tags={t.tags} max={2} small />
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className="rounded px-2 py-0.5 text-xs font-medium"
                    style={{ backgroundColor: STATUS_COLORS[t.status] + "26", color: STATUS_COLORS[t.status] }}
                  >
                    {STATUS_LABELS[t.status]}
                  </span>
                </td>
                <td className="px-4 py-3"><AssigneeAvatars assignees={t.assignees} /></td>
                <td className="px-4 py-3 text-xs text-muted">{formatDate(t.dueDate)}</td>
                <td className="px-4 py-3 text-xs text-muted">
                  {t.spentHours > 0 ? formatHours(t.spentHours) : "—"}
                  {t.estimateHours ? ` / ${formatHours(t.estimateHours)}` : ""}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-muted">
                  Ничего не найдено
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
