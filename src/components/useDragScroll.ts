"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  decayVelocity,
  flingVelocity,
  isDragIntent,
  type DragAxis,
  type PointerSample,
} from "@/lib/dragScroll";

/** На этих элементах зажатие — это ввод и выделение текста, а не протяжка. */
const IGNORE_SELECTOR =
  'input, textarea, select, option, [contenteditable="true"], [data-no-drag-scroll]';

export interface DragScrollOptions {
  /** Ось прокрутки: горизонтальные ленты — "x" (по умолчанию). */
  axis?: DragAxis;
  enabled?: boolean;
  /** Инерция после броска. Отключается при prefers-reduced-motion. */
  momentum?: boolean;
}

/**
 * Прокрутка контейнера протяжкой мыши — как панорамирование в графе задач:
 * зажали ленту, потянули, она едет за курсором и по инерции доезжает после
 * отпускания. Возвращает ref-колбэк: `<div ref={useDragScroll()}>`.
 *
 * Тонкости, ради которых хук существует:
 * • клик не ломается — протяжка включается только после порога сдвига,
 *   а «пойманный» ею клик гасится на фазе захвата;
 * • нативный drag&drop (карточки и колонки доски) имеет приоритет: на
 *   `dragstart` протяжку отменяем;
 * • тач не трогаем — там прокрутка пальцем и так родная;
 * • курсор-«рука» ставится только когда есть куда прокручивать.
 */
export function useDragScroll<T extends HTMLElement>(options: DragScrollOptions = {}) {
  // Настройки читаем в момент события, а не привязки — так смена оси или
  // enabled не требует переподписки на элемент.
  const optsRef = useRef(options);
  useEffect(() => {
    optsRef.current = options;
  });

  return useCallback((node: T | null) => {
    if (!node) return;
    const el = node;

    let pointerId: number | null = null;
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    let samples: PointerSample[] = [];
    let frame = 0;

    const axis = (): DragAxis => optsRef.current.axis ?? "x";
    const canX = () => axis() !== "y" && el.scrollWidth - el.clientWidth > 1;
    const canY = () => axis() !== "x" && el.scrollHeight - el.clientHeight > 1;

    /** Курсор-«рука» появляется, только если ленте есть куда ехать. */
    function markScrollable() {
      if ((canX() || canY()) && optsRef.current.enabled !== false) {
        el.dataset.dragScroll = "true";
      } else {
        delete el.dataset.dragScroll;
      }
    }

    function stopMomentum() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    }

    function reset() {
      if (pointerId !== null && el.hasPointerCapture(pointerId)) {
        el.releasePointerCapture(pointerId);
      }
      pointerId = null;
      dragging = false;
      samples = [];
      el.classList.remove("drag-scrolling");
    }

    /** Гасит клик, который браузер выдаст после протяжки (карточка/вкладка). */
    function swallowNextClick() {
      const swallow = (ev: MouseEvent) => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      el.addEventListener("click", swallow, { capture: true, once: true });
      // Клика может и не быть (курсор ушёл с элемента) — снимаем слушатель,
      // чтобы он не съел следующий, уже настоящий клик.
      setTimeout(() => el.removeEventListener("click", swallow, true), 0);
    }

    function startMomentum(vx: number, vy: number) {
      let curX = canX() ? vx : 0;
      let curY = canY() ? vy : 0;
      if (!curX && !curY) return;
      let last = performance.now();

      const step = (now: number) => {
        frame = 0;
        // Долгий кадр (вкладка была в фоне) не должен телепортировать ленту
        const dt = Math.min(now - last, 50);
        last = now;
        if (curX) {
          const before = el.scrollLeft;
          el.scrollLeft = before - curX * dt;
          // Упёрлись в край — дальше катиться некуда
          curX = el.scrollLeft === before ? 0 : decayVelocity(curX, dt);
        }
        if (curY) {
          const before = el.scrollTop;
          el.scrollTop = before - curY * dt;
          curY = el.scrollTop === before ? 0 : decayVelocity(curY, dt);
        }
        if (curX || curY) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    }

    function onPointerDown(e: PointerEvent) {
      stopMomentum();
      if (optsRef.current.enabled === false) return;
      if (e.button !== 0 || e.pointerType === "touch") return;
      markScrollable();
      if (!canX() && !canY()) return;
      if ((e.target as Element | null)?.closest(IGNORE_SELECTOR)) return;

      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = el.scrollLeft;
      startTop = el.scrollTop;
      samples = [{ t: e.timeStamp, x: e.clientX, y: e.clientY }];
    }

    function onPointerMove(e: PointerEvent) {
      if (pointerId !== e.pointerId) return;
      // Кнопку отпустили вне элемента — жест закончился, а pointerup мы
      // не услышали (захвата ещё не было).
      if (e.buttons === 0) {
        reset();
        return;
      }

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!dragging) {
        if (!isDragIntent(dx, dy, axis())) return;
        dragging = true;
        // Захват держит жест на элементе, даже если курсор ушёл за его границы.
        // Браузер может отказать (указатель уже отпущен) — протяжке это
        // не мешает, поэтому просто продолжаем.
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* захват не обязателен */
        }
        el.classList.add("drag-scrolling");
        // Выделение, начатое до порога, иначе тянется за курсором
        window.getSelection()?.removeAllRanges();
      }

      if (canX()) el.scrollLeft = startLeft - dx;
      if (canY()) el.scrollTop = startTop - dy;

      samples.push({ t: e.timeStamp, x: e.clientX, y: e.clientY });
      if (samples.length > 12) samples.shift();
      e.preventDefault();
    }

    function onPointerUp(e: PointerEvent) {
      if (pointerId !== e.pointerId) return;
      const wasDragging = dragging;
      const { vx, vy } = flingVelocity(samples, e.timeStamp);
      reset();
      if (!wasDragging) return;
      swallowNextClick();
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (optsRef.current.momentum !== false && !reduceMotion) startMomentum(vx, vy);
    }

    /** Нативный drag&drop важнее: карточку тащим, а не доску. */
    function onDragStart() {
      stopMomentum();
      reset();
    }

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove, { passive: false });
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", reset);
    el.addEventListener("pointerenter", markScrollable);
    el.addEventListener("dragstart", onDragStart);
    el.addEventListener("wheel", stopMomentum, { passive: true });
    markScrollable();

    // React 19 вызывает эту функцию, когда элемент уходит из DOM
    return () => {
      stopMomentum();
      reset();
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", reset);
      el.removeEventListener("pointerenter", markScrollable);
      el.removeEventListener("dragstart", onDragStart);
      el.removeEventListener("wheel", stopMomentum);
      delete el.dataset.dragScroll;
    };
  }, []);
}
