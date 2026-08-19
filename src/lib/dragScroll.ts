/**
 * Математика «протяжки» горизонтальных лент мышью (см. useDragScroll):
 * порог клик/протяжка, скорость броска и затухание инерции.
 * Вынесено из хука отдельно — здесь нет DOM, и это можно проверить тестами.
 */

/** Точка трека указателя: время (мс) и координаты курсора. */
export interface PointerSample {
  t: number;
  x: number;
  y: number;
}

export type DragAxis = "x" | "y" | "both";

/** Сдвиг в px, после которого зажатие считается протяжкой, а не кликом. */
export const DRAG_THRESHOLD = 5;

/** Окно (мс) для расчёта скорости броска: берём только конец жеста, иначе
 *  инерция уходит туда, куда рука двигалась в среднем, а не в последний момент. */
export const VELOCITY_WINDOW = 90;

/** Доля скорости, остающаяся за кадр 60 fps. */
export const FRICTION = 0.94;

/** Ниже этой скорости (px/мс) инерцию гасим — иначе лента ползёт бесконечно. */
export const MIN_VELOCITY = 0.02;

/** Потолок скорости броска (px/мс): защита от выброса на рывке. */
export const MAX_VELOCITY = 4;

/** Началась ли протяжка: сдвиг по значимой для оси дистанции превысил порог. */
export function isDragIntent(
  dx: number,
  dy: number,
  axis: DragAxis,
  threshold: number = DRAG_THRESHOLD
): boolean {
  const dist =
    axis === "x" ? Math.abs(dx) : axis === "y" ? Math.abs(dy) : Math.hypot(dx, dy);
  return dist >= threshold;
}

function clampVelocity(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, v));
}

/**
 * Скорость броска (px/мс): путь, пройденный за окно `window` перед моментом
 * `now` (отпускание кнопки).
 *
 * Окно отсчитывается от `now`, а не от последней точки трека, — поэтому
 * «довёл и подержал» само гасит инерцию: пауза попадает в знаменатель, а
 * если держали дольше окна, броска нет вовсе.
 */
export function flingVelocity(
  samples: PointerSample[],
  now: number,
  window: number = VELOCITY_WINDOW
): { vx: number; vy: number } {
  const last = samples[samples.length - 1];
  if (!last || now - last.t > window) return { vx: 0, vy: 0 };

  let first = last;
  for (let i = samples.length - 2; i >= 0; i--) {
    const s = samples[i]!;
    if (now - s.t > window) break;
    first = s;
  }

  const dt = now - first.t;
  if (dt <= 0) return { vx: 0, vy: 0 };
  return {
    vx: clampVelocity((last.x - first.x) / dt),
    vy: clampVelocity((last.y - first.y) / dt),
  };
}

/** Скорость после кадра длительностью `dt` мс; у порога сразу до нуля. */
export function decayVelocity(v: number, dt: number, friction: number = FRICTION): number {
  const next = v * Math.pow(friction, dt / 16.7);
  return Math.abs(next) < MIN_VELOCITY ? 0 : next;
}

/** Ширина полосы у края ленты, в которой перетаскивание начинает её крутить. */
export const EDGE_ZONE = 72;

/** Скорость автопрокрутки у самого края (px/мс). */
export const EDGE_MAX_SPEED = 1.6;

/**
 * Скорость автопрокрутки ленты, когда над ней тащат карточку: отрицательная —
 * к началу, положительная — к концу, ноль — в середине.
 *
 * Нужна потому, что во время нативного drag&drop указатель отдан браузеру и
 * протяжка не работает: без автопрокрутки колонку за краем экрана не достать.
 * Скорость растёт линейно по мере приближения к краю, за пределами ленты —
 * максимум. Зона ужимается до трети ленты, чтобы у узкой всегда оставалась
 * нейтральная середина.
 */
export function edgeScrollSpeed(
  pos: number,
  start: number,
  end: number,
  zone: number = EDGE_ZONE,
  max: number = EDGE_MAX_SPEED
): number {
  const size = end - start;
  if (size <= 0) return 0;
  const z = Math.min(zone, size / 3);
  if (z <= 0) return 0;

  const fromStart = pos - start;
  if (fromStart < z) return -max * Math.min(1, (z - fromStart) / z);

  const fromEnd = end - pos;
  if (fromEnd < z) return max * Math.min(1, (z - fromEnd) / z);

  return 0;
}

/** Край ленты, за которым спрятан контент: его и растворяем подсказкой. */
export type ScrollEdge = "" | "start" | "end" | "both";

/**
 * Какие края ленты «продолжаются» за пределы видимой части.
 * Допуск в 1 px — прокрутка бывает дробной, и без него лента у самого конца
 * считалась бы недокрученной, а подсказка мигала бы.
 */
export function hiddenEdges(pos: number, max: number, tolerance = 1): ScrollEdge {
  if (max <= tolerance) return "";
  const atStart = pos <= tolerance;
  const atEnd = pos >= max - tolerance;
  if (atStart && atEnd) return "";
  if (atStart) return "end";
  if (atEnd) return "start";
  return "both";
}

/** Доля видимой части, на которую сдвигают ленту стрелки. */
export const KEY_STEP_RATIO = 0.2;
/** Границы шага стрелок (px): маленькая лента не ползёт, большая не прыгает. */
export const KEY_STEP_MIN = 64;
export const KEY_STEP_MAX = 320;
/** Доля видимой части для PageUp/PageDown — почти экран, с нахлёстом. */
export const KEY_PAGE_RATIO = 0.9;

/** Что сделать с лентой по нажатой клавише. */
export interface KeyScroll {
  /** Сдвиг по осям в px (стрелки, Page). */
  dx: number;
  dy: number;
  /** Прыжок к началу или концу основной оси (Home/End). */
  jump?: "start" | "end";
}

/**
 * Как ответить на клавишу, когда фокус на самой ленте: стрелки и Page двигают
 * её вдоль своей оси, Home/End прыгают к краям. Клавиши поперёк оси не трогаем
 * — их ждёт страница, и перехват сломал бы обычную прокрутку.
 */
export function keyboardScroll(
  key: string,
  viewport: number,
  axis: DragAxis
): KeyScroll | null {
  const step = Math.min(KEY_STEP_MAX, Math.max(KEY_STEP_MIN, viewport * KEY_STEP_RATIO));
  const page = viewport * KEY_PAGE_RATIO;
  const horizontal = axis !== "y";
  const vertical = axis !== "x";

  switch (key) {
    case "ArrowLeft":
      return horizontal ? { dx: -step, dy: 0 } : null;
    case "ArrowRight":
      return horizontal ? { dx: step, dy: 0 } : null;
    case "ArrowUp":
      return vertical ? { dx: 0, dy: -step } : null;
    case "ArrowDown":
      return vertical ? { dx: 0, dy: step } : null;
    case "PageUp":
      return horizontal ? { dx: -page, dy: 0 } : { dx: 0, dy: -page };
    case "PageDown":
      return horizontal ? { dx: page, dy: 0 } : { dx: 0, dy: page };
    case "Home":
      return { dx: 0, dy: 0, jump: "start" };
    case "End":
      return { dx: 0, dy: 0, jump: "end" };
    default:
      return null;
  }
}
