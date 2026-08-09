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
