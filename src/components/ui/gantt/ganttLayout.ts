/**
 * Раскладка диаграммы Ганта — без React и без DOM.
 *
 * Здесь всё, что легко сломать незаметно: шкала дат, ширина дня, положение
 * полос, критический путь и применение перетаскивания к датам. Такое
 * проверяется тестами, а не разглядыванием диаграммы.
 */

export const DAY_MS = 86_400_000;

/** Полдень не спасёт от смены даты при сдвиге — приводим к началу суток. */
export function startOfDay(date: Date | string | number): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Дата в формате YYYY-MM-DD — в нём же её ждёт <input type="date">. */
export function toISODate(date: Date | number): string {
  const d = new Date(date);
  // toISOString переводит в UTC и в отрицательных зонах сдвигает дату
  // на сутки назад — собираем строку из локальных частей
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/** Элемент диаграммы: то немногое, что нужно раскладке. */
export interface GanttItemLike {
  id: string;
  startDate?: string | null;
  dueDate?: string | null;
}

/** Связь «from блокирует to». */
export interface GanttEdge {
  fromId: string;
  toId: string;
}

/** Элемент с разрешёнными датами. */
export interface GanttRow<I extends GanttItemLike> {
  item: I;
  from: Date;
  to: Date;
}

/**
 * Элементы, которые вообще попадают на диаграмму, в порядке начала.
 *
 * Одна проставленная дата — тоже полоса: элемент с одним сроком и без начала
 * рисуется однодневным, иначе половина плана просто не была бы видна.
 * Срок раньше начала не даёт полосу «наизнанку» — она схлопывается в день.
 */
export function datedRows<I extends GanttItemLike>(items: I[]): GanttRow<I>[] {
  return items
    .map((item) => {
      const s = item.startDate ? startOfDay(item.startDate) : null;
      const e = item.dueDate ? startOfDay(item.dueDate) : null;
      const from = s ?? e;
      const to = e ?? s;
      if (!from || !to) return null;
      return { item, from, to: to >= from ? to : from };
    })
    .filter((r): r is GanttRow<I> => r !== null)
    .sort((a, b) => a.from.getTime() - b.from.getTime());
}

export interface GanttScale {
  /** Первый день шкалы (с запасом слева). */
  scaleStart: Date;
  /** Сколько дней помещается на шкале. */
  totalDays: number;
  /** Ширина дня в px: плотный план ужимается, короткий дышит. */
  dayWidth: number;
  /** Смещение сегодняшнего дня в днях от начала шкалы. Может быть вне шкалы. */
  todayOffset: number;
  months: { label: string; dayOffset: number }[];
}

/** Запас в днях слева и справа, чтобы крайние полосы не липли к границе. */
export const SCALE_PAD = 2;

/**
 * Шкала дат под набор полос.
 *
 * Ширина дня подбирается по длине плана: на годовом горизонте 32 px на день
 * дали бы полотно, по которому невозможно листать, а на двухнедельном 12 px
 * слепили бы полосы в кашу.
 */
export function buildScale<I extends GanttItemLike>(
  rows: GanttRow<I>[],
  { today = new Date(), locale }: { today?: Date; locale?: string } = {}
): GanttScale | null {
  if (rows.length === 0) return null;

  const min = startOfDay(Math.min(...rows.map((r) => r.from.getTime())));
  const max = startOfDay(Math.max(...rows.map((r) => r.to.getTime())));
  const scaleStart = new Date(min.getTime() - SCALE_PAD * DAY_MS);
  const totalDays =
    Math.round((max.getTime() - scaleStart.getTime()) / DAY_MS) + SCALE_PAD + 2;
  const dayWidth = totalDays > 90 ? 12 : totalDays > 45 ? 20 : 32;

  const months: { label: string; dayOffset: number }[] = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(scaleStart.getTime() + i * DAY_MS);
    // Подписываем первое число каждого месяца — и самый левый день,
    // иначе шкала начиналась бы без подписи
    if (d.getDate() === 1 || i === 0) {
      months.push({
        label: d.toLocaleDateString(locale, { month: "short", year: "2-digit" }),
        dayOffset: i,
      });
    }
  }

  return {
    scaleStart,
    totalDays,
    dayWidth,
    todayOffset: Math.round((startOfDay(today).getTime() - scaleStart.getTime()) / DAY_MS),
    months,
  };
}

/** Где и какой длины полоса. */
export interface BarPlacement {
  /** Номер строки сверху вниз. */
  row: number;
  /** Смещение в днях от начала шкалы. */
  offset: number;
  /** Длительность в днях, минимум 1. */
  span: number;
}

/** Положение каждой полосы на шкале. */
export function layoutBars<I extends GanttItemLike>(
  rows: GanttRow<I>[],
  scaleStart: Date
): Map<string, BarPlacement> {
  const layout = new Map<string, BarPlacement>();
  rows.forEach((row, index) => {
    layout.set(row.item.id, {
      row: index,
      offset: Math.round((row.from.getTime() - scaleStart.getTime()) / DAY_MS),
      // +1: полоса с одинаковыми началом и концом занимает один день,
      // а не нулевую ширину
      span: Math.round((row.to.getTime() - row.from.getTime()) / DAY_MS) + 1,
    });
  });
  return layout;
}

export interface CriticalPath {
  /** Элементы, лежащие на критическом пути. */
  ids: Set<string>;
  /** Предшественник каждого элемента в самой длинной цепочке. */
  previous: Map<string, string | null>;
}

/**
 * Критический путь: самая длинная по суммарной длительности цепочка
 * зависимостей.
 *
 * Считается по топологическому порядку. Если порядок построить не удалось,
 * в графе есть цикл — критического пути тогда просто нет, и показывать
 * произвольную цепочку было бы враньём.
 *
 * Одиночный элемент путём не считается: «критический путь из одной задачи»
 * ничего не сообщает о плане.
 */
export function criticalPath(
  ids: Set<string>,
  edges: GanttEdge[],
  durationOf: (id: string) => number
): CriticalPath {
  const empty: CriticalPath = { ids: new Set(), previous: new Map() };
  const usable = edges.filter(
    (e) => ids.has(e.fromId) && ids.has(e.toId) && e.fromId !== e.toId
  );
  if (usable.length === 0) return empty;

  const adjacency = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  ids.forEach((id) => indegree.set(id, 0));
  for (const e of usable) {
    const list = adjacency.get(e.fromId);
    if (list) list.push(e.toId);
    else adjacency.set(e.fromId, [e.toId]);
    indegree.set(e.toId, (indegree.get(e.toId) ?? 0) + 1);
  }

  const order: string[] = [];
  const queue = [...ids].filter((id) => indegree.get(id) === 0);
  const left = new Map(indegree);
  while (queue.length > 0) {
    const node = queue.shift()!;
    order.push(node);
    for (const next of adjacency.get(node) ?? []) {
      left.set(next, left.get(next)! - 1);
      if (left.get(next) === 0) queue.push(next);
    }
  }
  // Не все вершины разложились — в графе цикл
  if (order.length !== ids.size) return empty;

  const distance = new Map<string, number>();
  const previous = new Map<string, string | null>();
  ids.forEach((id) => {
    distance.set(id, durationOf(id));
    previous.set(id, null);
  });
  for (const node of order) {
    for (const next of adjacency.get(node) ?? []) {
      const candidate = distance.get(node)! + durationOf(next);
      if (candidate > distance.get(next)!) {
        distance.set(next, candidate);
        previous.set(next, node);
      }
    }
  }

  let end: string | null = null;
  let best = -1;
  ids.forEach((id) => {
    const d = distance.get(id)!;
    if (d > best) {
      best = d;
      end = id;
    }
  });

  const path: string[] = [];
  let current: string | null = end;
  while (current) {
    path.push(current);
    current = previous.get(current) ?? null;
  }
  if (path.length <= 1) return empty;

  return { ids: new Set(path), previous };
}

export type DragMode = "move" | "start" | "end";

export interface GanttDrag {
  itemId: string;
  mode: DragMode;
  /** Координата указателя в начале жеста. */
  startX: number;
  origFrom: number;
  origTo: number;
  /** Сдвиг в днях. */
  delta: number;
}

/**
 * Даты после перетаскивания.
 *
 * Полоса целиком едет обоими концами; края двигают только свой конец
 * и упираются в противоположный — иначе полосу можно было бы вывернуть
 * наизнанку и получить срок раньше начала.
 */
export function applyDrag(drag: GanttDrag): { from: number; to: number } {
  const shift = drag.delta * DAY_MS;
  if (drag.mode === "move") {
    return { from: drag.origFrom + shift, to: drag.origTo + shift };
  }
  if (drag.mode === "start") {
    return { from: Math.min(drag.origTo, drag.origFrom + shift), to: drag.origTo };
  }
  return { from: drag.origFrom, to: Math.max(drag.origFrom, drag.origTo + shift) };
}

/** Сдвиг указателя в днях. */
export function deltaDays(currentX: number, startX: number, dayWidth: number): number {
  return Math.round((currentX - startX) / dayWidth);
}
