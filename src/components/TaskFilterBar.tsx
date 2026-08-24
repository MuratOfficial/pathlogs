"use client";

// Обёртка над реестровым FilterBar (@/components/ui/filter-bar). Панель фильтров
// теперь собирается из описания полей, а доменная модель фильтра осталась в
// lib/taskFilter.ts (её же используют доска, список и тесты). TaskFilter
// структурно совпадает с FilterState реестра (Record<string,string> с "ALL"),
// поэтому значение прокидывается напрямую, а onChange добивается EMPTY_FILTER:
// в compact-режиме доски поля status/tag не рендерятся, и без добивки reset
// вернул бы фильтр без этих ключей — matchesTaskFilter сломался бы на undefined.
import type { TaskStatus, TaskType, Priority } from "@prisma/client";
import type { MemberDTO, TagDTO } from "@/lib/types";
import { PRIORITY_LABELS, STATUS_LABELS, TYPE_LABELS } from "@/lib/labels";
import { saveFilterAction, deleteFilterAction } from "@/lib/actions/filters";
import { FilterBar, type SavedFilter } from "@/components/ui/filter-bar/FilterBar";
import {
  textMatcher,
  equalsMatcher,
  includesMatcher,
  type FilterField,
  type FilterState,
} from "@/components/ui/filter-bar/filterModel";
import { EMPTY_FILTER, type TaskFilter } from "@/lib/taskFilter";

export type SavedFilterDTO = SavedFilter;

/** Минимум, по которому поля отбирают задачу (FilterField требует matches). */
interface FilterableItem {
  number: number;
  title: string;
  status: string;
  type: string;
  priority: string;
  assignees: { id: string }[];
  tags: { id: string }[];
}

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
  const fields: FilterField<FilterableItem>[] = [
    {
      key: "q",
      label: "Поиск",
      kind: "text",
      placeholder: "Название или номер…",
      matches: textMatcher((t) => [t.title, t.number]),
    },
    // На доске статус читается по колонке — селект только в списке.
    ...(compact
      ? []
      : [
          {
            key: "status",
            label: "Статус",
            kind: "select" as const,
            anyLabel: "Все статусы",
            options: (Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => ({
              value: s,
              label: STATUS_LABELS[s],
            })),
            matches: equalsMatcher<FilterableItem>((t) => t.status),
          },
        ]),
    {
      key: "type",
      label: "Тип",
      kind: "select",
      anyLabel: "Все типы",
      options: (Object.keys(TYPE_LABELS) as TaskType[]).map((t) => ({
        value: t,
        label: TYPE_LABELS[t],
      })),
      matches: equalsMatcher((t) => t.type),
    },
    {
      key: "priority",
      label: "Приоритет",
      kind: "select",
      anyLabel: "Любой приоритет",
      options: (Object.keys(PRIORITY_LABELS) as Priority[]).map((p) => ({
        value: p,
        label: PRIORITY_LABELS[p],
      })),
      matches: equalsMatcher((t) => t.priority),
    },
    {
      key: "assignee",
      label: "Исполнитель",
      kind: "select",
      anyLabel: "Все исполнители",
      options: members.map((m) => ({ value: m.id, label: m.name })),
      matches: includesMatcher((t) => t.assignees),
    },
    ...(projectTags.length > 0
      ? [
          {
            key: "tag",
            label: "Метка",
            kind: "select" as const,
            anyLabel: "Все метки",
            options: projectTags.map((t) => ({ value: t.id, label: t.name })),
            matches: includesMatcher<FilterableItem>((t) => t.tags),
          },
        ]
      : []),
  ];

  return (
    <FilterBar<FilterableItem>
      fields={fields}
      value={filter as unknown as FilterState}
      onChange={(next) => onChange({ ...EMPTY_FILTER, ...(next as Partial<TaskFilter>) })}
      savedFilters={savedFilters}
      onSaveFilter={(name, query) => saveFilterAction(projectId, name, query)}
      onDeleteFilter={(id) => deleteFilterAction(id)}
      matchedCount={matchedCount}
      totalCount={totalCount}
      compact={compact}
      labels={{
        reset: "Сбросить",
        save: "Сохранить",
        presets: "Сохранённые",
        matched: "{matched} из {total}",
        cancel: "Отмена",
        savePrompt: "Название фильтра",
        saveTitle: "Сохранить фильтр",
        deleteTitle: "Удалить сохранённый фильтр?",
        deletePreset: "Удалить фильтр",
      }}
    />
  );
}
