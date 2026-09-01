"use client";

import { useCallback } from "react";
import {
  decodeScroll,
  encodeScroll,
  scrollStorageKey,
  type ScrollPosition,
} from "@/components/ui/scrollMemory";

/** Ось, положение по которой запоминаем. */
export type ScrollMemoryAxis = "x" | "y" | "both";

/**
 * Сколько миллисекунд после появления ленты пытаемся восстановить положение.
 * Контент доезжает не в первом кадре (колонки, карточки, шрифты), поэтому
 * одной попытки мало, а тянуть дольше — значит дёргать ленту под руками.
 */
const RESTORE_WINDOW_MS = 700;

/** Событие пользователя, после которого лента принадлежит ему, а не памяти. */
const USER_EVENTS = ["pointerdown", "wheel", "keydown", "touchstart"] as const;

function read(key: string): ScrollPosition | null {
  try {
    return decodeScroll(sessionStorage.getItem(scrollStorageKey(key)));
  } catch {
    // приватный режим и запрет хранилища — просто живём без памяти
    return null;
  }
}

function write(key: string, pos: ScrollPosition) {
  try {
    sessionStorage.setItem(scrollStorageKey(key), encodeScroll(pos));
  } catch {
    /* см. read */
  }
}

/**
 * Запоминает, куда прокручена лента, и возвращает её туда при следующем
 * появлении. Нужно на доске проекта: переход в задачу и назад отматывал
 * колонки в самое начало, и найденное место приходилось искать заново.
 *
 * Память живёт в sessionStorage — она про текущую вкладку и текущий сеанс
 * работы, а не про пользователя: через день возвращаться в ту же точку доски
 * уже незачем.
 *
 * Возвращает ref-колбэк; его можно совмещать с другими (см. composeRefs):
 * ```tsx
 * <div ref={useScrollMemory("board:" + projectId)} className="overflow-x-auto">
 * ```
 */
export function useScrollMemory<T extends HTMLElement>(
  key: string | null | undefined,
  axis: ScrollMemoryAxis = "x"
): (node: T | null) => (() => void) | undefined {
  return useCallback(
    (node: T | null) => {
      if (!node || !key) return;

      const saved = read(key);
      let restoring = saved !== null;
      let restoreFrame = 0;
      let saveFrame = 0;

      const current = (): ScrollPosition => ({
        left: node.scrollLeft,
        top: node.scrollTop,
      });

      const deadline = Date.now() + RESTORE_WINDOW_MS;

      function restore() {
        if (!restoring || !saved) return;
        if (axis !== "y") node!.scrollLeft = saved.left;
        if (axis !== "x") node!.scrollTop = saved.top;

        // Пока лента короче запомненного места, браузер обрежет прокрутку —
        // повторяем, пока контент дорастает
        const atX = axis === "y" || Math.abs(node!.scrollLeft - saved.left) < 1;
        const atY = axis === "x" || Math.abs(node!.scrollTop - saved.top) < 1;
        if ((atX && atY) || Date.now() > deadline) {
          restoring = false;
          return;
        }
        restoreFrame = requestAnimationFrame(restore);
      }

      /** Тронули ленту руками — дальше она слушается только пользователя. */
      function release() {
        restoring = false;
        cancelAnimationFrame(restoreFrame);
      }

      function onScroll() {
        // Пока идёт восстановление, свои же прокрутки не записываем: иначе
        // память затёрлась бы нулём, пока лента ещё не доехала
        if (restoring || saveFrame) return;
        saveFrame = requestAnimationFrame(() => {
          saveFrame = 0;
          write(key!, current());
        });
      }

      restore();
      node.addEventListener("scroll", onScroll, { passive: true });
      for (const e of USER_EVENTS) {
        node.addEventListener(e, release, { passive: true });
      }

      return () => {
        cancelAnimationFrame(restoreFrame);
        cancelAnimationFrame(saveFrame);
        node.removeEventListener("scroll", onScroll);
        for (const e of USER_EVENTS) node.removeEventListener(e, release);
        // Последнее положение записываем на уходе: переход по ссылке снимает
        // ленту с DOM раньше, чем успевает сработать отложенная запись
        if (!restoring) write(key, current());
      };
    },
    [key, axis]
  );
}

/**
 * Склеивает несколько ref-колбэков в один. React 19 умеет чистить ref через
 * возвращаемую функцию — собираем их все, иначе один из хуков остался бы
 * подписанным на уже снятый элемент.
 */
export function composeRefs<T>(
  ...refs: ((node: T | null) => (() => void) | void)[]
): (node: T | null) => () => void {
  return (node: T | null) => {
    const cleanups = refs.map((ref) => ref(node)).filter(Boolean) as (() => void)[];
    return () => {
      for (const c of cleanups) c();
    };
  };
}
