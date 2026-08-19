"use client";

import { useCallback, useEffect, useRef } from "react";
import { attachDragScroll, type DragScrollOptions } from "@/lib/dragScrollBinding";

export type { DragScrollOptions };

/**
 * Прокрутка контейнера протяжкой мыши — как панорамирование в графе задач:
 * зажали ленту, потянули, она едет за курсором и по инерции доезжает после
 * отпускания. Возвращает ref-колбэк: `<div ref={useDragScroll()}>`.
 *
 * Вся механика — в attachDragScroll (там же её описание и тесты); здесь
 * только мост к React.
 */
export function useDragScroll<T extends HTMLElement>(options: DragScrollOptions = {}) {
  // Настройки читаем в момент события, а не привязки
  const optsRef = useRef(options);
  useEffect(() => {
    optsRef.current = options;
  });

  // React 19 сам вызовет функцию очистки, когда элемент уйдёт из DOM
  return useCallback((node: T | null) => {
    if (!node) return;
    return attachDragScroll(node, () => optsRef.current);
  }, []);
}
