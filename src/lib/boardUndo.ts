/**
 * Снимок положения карточки до переноса — то, что возвращает кнопка «Вернуть».
 *
 * Чистая функция, а не строчка внутри обработчика: ошибиться здесь легко и
 * незаметно. Неверная колонка отправит задачу не туда, а потерянный порядок
 * поставит её в конец — и то и другое выглядит как «отмена сломала доску».
 */

/** Минимум, который нужен для восстановления положения. */
export type MovableItem = {
  id: string;
  columnId: string;
  order: number;
  title: string;
};

export type TaskMove = {
  taskId: string;
  columnId: string;
  /** Порядок карточек в исходной колонке, вместе с самой перенесённой. */
  orderedIds: string[];
  title: string;
};

/**
 * Где карточка лежала до переноса. Считать нужно ДО вызова действия: после
 * него список уже перестроится.
 *
 * null — карточки нет в списке (например, её отфильтровали): предлагать
 * отмену того, чего мы не видели, нельзя.
 */
export function snapshotMove(items: MovableItem[], taskId: string): TaskMove | null {
  const from = items.find((t) => t.id === taskId);
  if (!from) return null;
  const orderedIds = items
    .filter((t) => t.columnId === from.columnId)
    .sort((a, b) => a.order - b.order)
    .map((t) => t.id);
  return { taskId, columnId: from.columnId, orderedIds, title: from.title };
}

/**
 * Стоит ли вообще предлагать отмену.
 *
 * Перестановка внутри колонки ничего не ломает и происходит постоянно —
 * всплывашка после каждого перетаскивания быстро превращается в шум.
 */
export function shouldOfferUndo(before: TaskMove | null, toColumnId: string): before is TaskMove {
  return before !== null && before.columnId !== toColumnId;
}
