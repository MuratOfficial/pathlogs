/**
 * Порядок карточек и колонок доски — без React и без DOM.
 *
 * Вынесено из компонента отдельно, потому что именно здесь живут все
 * неочевидные правила: куда встанет карточка при разных режимах сортировки,
 * что делать при активном фильтре, как пересобрать порядок колонок. Такое
 * проверяется тестами, а не кликами по доске.
 */

/** Порядок карточек внутри колонки. */
export type KanbanSort = "MANUAL" | "CREATED_DESC" | "CREATED_ASC";

/** Минимум, который доска знает о колонке. */
export interface KanbanColumnLike {
  id: string;
  order: number;
  sort?: KanbanSort;
  hidden?: boolean;
  wipLimit?: number | null;
}

/** Минимум, который доска знает о карточке. */
export interface KanbanItemLike {
  id: string;
  columnId: string | null;
  order: number;
  /** ISO-строка. Сравнивается лексикографически — для ISO это тот же порядок. */
  createdAt: string;
}

/** Видимые колонки по возрастанию порядка. */
export function visibleColumns<C extends KanbanColumnLike>(columns: C[]): C[] {
  return [...columns].sort((a, b) => a.order - b.order).filter((c) => !c.hidden);
}

/** Скрытые колонки по возрастанию порядка. */
export function hiddenColumns<C extends KanbanColumnLike>(columns: C[]): C[] {
  return [...columns].sort((a, b) => a.order - b.order).filter((c) => c.hidden);
}

/**
 * Карточки колонки в том порядке, в каком они будут показаны.
 *
 * Сортировка не мутирует входной массив: он приходит из состояния React,
 * а сортировка на месте молча испортила бы его для остальных читателей.
 */
export function columnItems<I extends KanbanItemLike>(
  items: I[],
  column: KanbanColumnLike
): I[] {
  const list = items.filter((t) => t.columnId === column.id);
  if (column.sort === "CREATED_DESC") {
    return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  if (column.sort === "CREATED_ASC") {
    return [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  return [...list].sort((a, b) => a.order - b.order);
}

/**
 * Куда встанет карточка в колонке.
 *
 * При ручном порядке — туда, где курсор. При сортировке по дате порядок
 * задаёт сама дата, поэтому слот показываем там, где карточка окажется
 * на самом деле, а не под курсором: иначе она «прыгнула» бы после отпускания.
 *
 * При активном фильтре видно не все карточки, и «место под курсором» ничего
 * не говорит о настоящем порядке — кладём в конец.
 */
export function dropSlotIndex<I extends KanbanItemLike>({
  column,
  list,
  hovered,
  dragged,
  filtering = false,
}: {
  column: KanbanColumnLike;
  /** Карточки колонки без перетаскиваемой. */
  list: I[];
  /** Позиция под курсором. */
  hovered: number;
  dragged: I | null | undefined;
  filtering?: boolean;
}): number {
  if (filtering) return list.length;
  if (!column.sort || column.sort === "MANUAL") return Math.min(Math.max(hovered, 0), list.length);
  if (!dragged) return list.length;

  const desc = column.sort === "CREATED_DESC";
  const idx = list.findIndex((t) => {
    const cmp = t.createdAt.localeCompare(dragged.createdAt);
    return desc ? cmp < 0 : cmp > 0;
  });
  return idx === -1 ? list.length : idx;
}

/** Новый порядок id в колонке после вставки карточки на позицию `index`. */
export function insertAt(ids: string[], id: string, index: number): string[] {
  const next = ids.filter((x) => x !== id);
  next.splice(Math.min(Math.max(index, 0), next.length), 0, id);
  return next;
}

/**
 * Новый порядок колонок: перетаскиваемая встаёт на место целевой.
 *
 * Бросок колонки на саму себя порядок не меняет — иначе каждый промах
 * мышью порождал бы запись на сервер.
 */
export function reorderColumns(ids: string[], dragged: string, target: string): string[] {
  if (dragged === target) return ids;
  const next = ids.filter((id) => id !== dragged);
  const at = next.indexOf(target);
  if (at === -1) return ids;
  next.splice(at, 0, dragged);
  return next;
}

/** Превышен ли WIP-лимит колонки. Без лимита — никогда. */
export function isOverWipLimit(count: number, limit: number | null | undefined): boolean {
  return limit != null && count > limit;
}

/**
 * Куда встанет карточка при наведении на карточку с индексом `index`:
 * выше неё или ниже — по тому, в какой половине карточки курсор.
 */
export function hoverIndex(index: number, pointerY: number, top: number, height: number): number {
  return index + (pointerY > top + height / 2 ? 1 : 0);
}

/**
 * Раскладывает карточки колонки в порядок, который увидит пользователь,
 * и вычисляет новые значения `order` после перестановки.
 *
 * Шаг между соседями — 1: доска всё равно пересчитывает порядок целиком
 * при каждом переносе, поэтому разрежённая нумерация ничего бы не дала.
 */
export function applyOrder<I extends KanbanItemLike>(
  items: I[],
  columnId: string,
  orderedIds: string[]
): I[] {
  return items.map((item) => {
    const at = orderedIds.indexOf(item.id);
    // Карточки других колонок в orderedIds не входят — их не трогаем
    if (at === -1) return item;
    return { ...item, columnId, order: at };
  });
}
