/**
 * Разбор и сборка запомненного положения прокрутки (см. useScrollMemory).
 * Без DOM — эту часть можно проверить тестами.
 */

/** Положение ленты: горизонталь и вертикаль в пикселях. */
export interface ScrollPosition {
  left: number;
  top: number;
}

const PREFIX = "pl:scroll:";

/** Ключ в sessionStorage. Общий префикс — чтобы записи было видно и чистить. */
export function scrollStorageKey(key: string): string {
  return PREFIX + key;
}

/** Положение → строка «left,top». Дробные пиксели не храним: их не видно. */
export function encodeScroll(pos: ScrollPosition): string {
  return `${Math.round(pos.left)},${Math.round(pos.top)}`;
}

/**
 * Строка → положение. Мусор (чужая запись, обрезанное значение, отрицательные
 * числа) считаем отсутствием памяти: лучше открыть ленту с начала, чем прыгнуть
 * в непонятное место.
 */
export function decodeScroll(raw: string | null): ScrollPosition | null {
  if (!raw) return null;
  const [l, t] = raw.split(",");
  const left = Number(l);
  const top = Number(t);
  if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
  if (left < 0 || top < 0) return null;
  if (left === 0 && top === 0) return null;
  return { left, top };
}
