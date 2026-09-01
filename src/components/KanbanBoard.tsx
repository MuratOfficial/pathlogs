"use client";

// Доменная обёртка над реестровым Kanban (@/components/ui/kanban). Весь движок
// доски — перетаскивание карточек и колонок, WIP-лимиты, скрытые колонки,
// редактор колонки, оптимистичный порядок — живёт в реестре и покрыт тестами
// (kanbanOrder.ts). Здесь остаётся только то, что специфично для задач:
// содержимое карточки (renderCard), форма создания в колонке (renderColumnFooter),
// панель фильтров (toolbar), клавиша «d» и оптимистичные «готово»/цвет.
import { useMemo, useState, useTransition } from "react";
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
import { updateTaskStatusAction } from "@/lib/actions/tasks";
import { BOARD_PALETTE, formatDate, formatHours } from "@/lib/labels";
import { AssigneeAvatars, PriorityBadge, TagChips, TypeBadge } from "./TaskBadges";
import { TaskFilterBar, type SavedFilterDTO } from "./TaskFilterBar";
import { EMPTY_FILTER, isFilterActive, matchesTaskFilter, type TaskFilter } from "@/lib/taskFilter";
import { Kanban } from "@/components/ui/kanban/Kanban";

export type { SavedFilterDTO };

// Размеры popover палитры для расчёта позиции (ширина w-44 + переворот при нехватке места)
const PALETTE_W = 176;
const PALETTE_H = 124;

/** Палитра цвета карточки. Рендерится порталом с position: fixed — выходит
 *  за overflow-контейнер колонки и не обрезается. */
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

/** Задача с вычисленной колонкой — движку колонка нужна явно. */
type BoardItem = TaskDTO & { columnId: string };

export function KanbanBoard({
  tasks,
  columns,
  projectId,
  projectKey,
  canManageBoard,
  members,
  templates = [],
  projectTags = [],
  savedFilters = [],
  toolbarExtra,
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
  savedFilters?: SavedFilterDTO[];
  /** Индикатор живых обновлений — встаёт в ту же строку, что и фильтр. */
  toolbarExtra?: React.ReactNode;
}) {
  const router = useRouter();
  const [isPending, startOptimistic] = useTransition();

  // Фильтр доски: карточки не в фильтре прячутся, колонки остаются на месте.
  const [filter, setFilter] = useState<TaskFilter>(EMPTY_FILTER);
  const filtering = isFilterActive(filter);
  // Панель фильтров свёрнута: на доске дорог каждый пиксель высоты.
  const [filterOpen, setFilterOpen] = useState(false);

  // Палитра цвета карточки.
  const [paletteFor, setPaletteFor] = useState<string | null>(null);
  const [paletteRect, setPaletteRect] = useState<DOMRect | null>(null);

  // Оптимистичный слой поверх серверных tasks: «готово» и цвет должны
  // отражаться мгновенно, а перенос движок оптимизирует сам. Сбрасывается,
  // когда сервер прислал свежие tasks и наша транзакция завершилась.
  const [optimistic, setOptimistic] = useState<Record<string, Partial<TaskDTO>>>({});
  const [prevTasks, setPrevTasks] = useState(tasks);
  if (tasks !== prevTasks && !isPending) {
    setPrevTasks(tasks);
    setOptimistic({});
  }

  const visibleCols = useMemo(
    () => [...columns].filter((c) => !c.hidden).sort((a, b) => a.order - b.order),
    [columns]
  );

  // Колонка задачи: явная columnId, иначе по статусу среди видимых колонок;
  // CLOSED/ARCHIVED не показываются на доске.
  function columnOf(t: TaskDTO): string | null {
    if (t.columnId && columns.some((c) => c.id === t.columnId)) return t.columnId;
    if (t.status === "CLOSED" || t.status === "ARCHIVED") return null;
    return visibleCols.find((c) => c.status === t.status)?.id ?? null;
  }

  const items = useMemo<BoardItem[]>(() => {
    return tasks
      .map((raw) => {
        const t = optimistic[raw.id] ? { ...raw, ...optimistic[raw.id] } : raw;
        const cid = columnOf(t);
        return cid ? ({ ...t, columnId: cid } as BoardItem) : null;
      })
      .filter((x): x is BoardItem => x !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, columns, optimistic]);

  const boardCount = items.length;
  const matched = filtering ? items.filter((t) => matchesTaskFilter(t, filter)).length : boardCount;

  /** Быстрая отметка «Готово» (как в Trello): карточка остаётся в своей колонке. */
  function toggleTaskDone(t: BoardItem) {
    const isDone = t.status === "DONE" || t.status === "CLOSED";
    const next = isDone ? "TODO" : "DONE";
    setOptimistic((prev) => ({ ...prev, [t.id]: { status: next, columnId: t.columnId } }));
    startOptimistic(() => updateTaskStatusAction(t.id, next));
  }

  function recolorTask(taskId: string, color: string | null) {
    setOptimistic((prev) => ({ ...prev, [taskId]: { ...prev[taskId], color } }));
    startOptimistic(() => updateTaskColorAction(taskId, color));
  }

  function togglePalette(id: string, e: React.MouseEvent<HTMLButtonElement>) {
    if (paletteFor === id) {
      setPaletteFor(null);
    } else {
      setPaletteRect(e.currentTarget.getBoundingClientRect());
      setPaletteFor(id);
    }
  }

  const toolbar = (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setFilterOpen((v) => !v)}
          aria-expanded={filterOpen}
          data-tip={filterOpen ? "Свернуть фильтр" : "Фильтр карточек"}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
            filtering
              ? "border-accent/60 bg-accent/10 text-accent-hover"
              : "border-edge text-muted hover:bg-surface-2 hover:text-foreground"
          }`}
        >
          <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6h16.5M7 12h10M10.5 18h3" />
          </svg>
          Фильтр
          {filtering && <span className="tabular-nums">· {matched} из {boardCount}</span>}
        </button>

        {filtering && !filterOpen && (
          <button
            type="button"
            onClick={() => setFilter(EMPTY_FILTER)}
            className="rounded-lg border border-edge px-2.5 py-1.5 text-xs text-muted transition hover:bg-surface-2 hover:text-foreground"
          >
            Сбросить
          </button>
        )}
        {toolbarExtra && <span className="ml-auto">{toolbarExtra}</span>}
      </div>

      {filterOpen && (
        <div className="animate-fade-in rounded-xl border border-edge bg-surface/60 p-3">
          <TaskFilterBar
            compact
            filter={filter}
            onChange={setFilter}
            members={members}
            projectTags={projectTags}
            projectId={projectId}
            savedFilters={savedFilters}
            matchedCount={matched}
            totalCount={boardCount}
          />
        </div>
      )}
    </>
  );

  return (
    <Kanban<BoardItem, ColumnDTO>
      items={items}
      columns={columns}
      palette={BOARD_PALETTE}
      canManageColumns={canManageBoard}
      scrollKey={`project:${projectId}`}
      filter={filtering ? (t) => matchesTaskFilter(t, filter) : undefined}
      toolbar={toolbar}
      aria-label="Доска задач: стрелки прокручивают, Home и End — к краям"
      onMoveItem={(id, columnId, orderedIds) => moveTaskAction(id, columnId, orderedIds)}
      onReorderColumns={(ids) => reorderColumnsAction(projectId, ids)}
      onCreateColumn={(name, color) => createBoardColumnAction(projectId, name, color)}
      onUpdateColumn={(id, fields) => updateBoardColumnAction(id, fields)}
      onSetColumnHidden={(id, hidden) => setBoardColumnHiddenAction(id, hidden)}
      onDeleteColumn={(id) => deleteBoardColumnAction(id)}
      onOpenItem={(t) => router.push(`/tasks/${t.id}`)}
      onItemKeyDown={(t, e) => {
        if (e.key.toLowerCase() === "d") {
          e.preventDefault();
          toggleTaskDone(t);
        }
      }}
      renderColumnFooter={(col) => (
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
      )}
      labels={{
        addColumn: "Новая колонка",
        columnName: "Название колонки",
        dragColumn: "Перетащите, чтобы переставить колонку",
        configureColumn: "Настроить колонку",
        renameHint: "Двойной клик — переименовать",
        deleteTitle: "Удалить колонку?",
        deleteMessage: "Задачи не пропадут — они переедут в первую колонку доски. Статусы задач не изменятся.",
        hiddenColumns: "Скрытые колонки",
        restore: "показать",
        save: "Сохранить",
        cancel: "Отмена",
        hide: "Скрыть",
        delete: "Удалить",
        color: "Цвет",
        wipLimit: "WIP-лимит",
        wipLimitHint: "макс. карточек",
        cardOrder: "Порядок карточек",
        sortManual: "Вручную (перетаскиванием)",
        sortNewest: "По дате создания: новые сверху",
        sortOldest: "По дате создания: старые сверху",
      }}
      renderCard={(t) => {
        const isDone = t.status === "DONE" || t.status === "CLOSED";
        return (
          <div className={isDone ? "opacity-55 saturate-50 transition group-hover:opacity-100 group-hover:saturate-100" : ""}>
            <div className="mb-2 flex items-center gap-2">
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
              <span className="font-mono text-[11px] font-semibold text-muted">
                {projectKey}-{t.number}
              </span>
              <TypeBadge type={t.type} />
              <span className="relative ml-auto flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
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
                isDone ? "text-muted line-through decoration-muted/60" : ""
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
        );
      }}
    />
  );
}
