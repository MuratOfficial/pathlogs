/**
 * Привязка «протяжки» к DOM-элементу — без React, чтобы поведение можно было
 * проверить тестами: хук useDragScroll только вызывает эту функцию на своём
 * ref-колбэке. Настройки берём через `getOptions()` в момент события — смена
 * оси или enabled не требует переподписки.
 *
 * Что здесь происходит и почему:
 * • клик не ломается — протяжка включается только после порога сдвига,
 *   а «пойманный» ею клик гасится на фазе захвата;
 * • нативный drag&drop (карточки и колонки доски) имеет приоритет: на
 *   `dragstart` протяжку отменяем, а ленту у края крутим автопрокруткой —
 *   иначе бросить карточку в колонку за краем экрана нечем;
 * • тач не трогаем — там прокрутка пальцем и так родная;
 * • курсор-«рука» и растворение краёв — только когда есть куда прокручивать;
 * • с `keyboard: true` лента слушает стрелки, Page и Home/End — но только
 *   когда фокус на ней самой, а не на карточке внутри.
 */

import {
  decayVelocity,
  edgeScrollSpeed,
  flingVelocity,
  hiddenEdges,
  isDragIntent,
  keyboardScroll,
  type DragAxis,
  type PointerSample,
} from "./dragScroll";

/** На этих элементах зажатие — это ввод и выделение текста, а не протяжка. */
const IGNORE_SELECTOR =
  'input, textarea, select, option, [contenteditable="true"], [data-no-drag-scroll]';

export interface DragScrollOptions {
  /** Ось прокрутки: горизонтальные ленты — "x" (по умолчанию). */
  axis?: DragAxis;
  enabled?: boolean;
  /** Инерция после броска. Отключается при prefers-reduced-motion. */
  momentum?: boolean;
  /**
   * Прокрутка с клавиатуры: лента становится в порядок табуляции и слушает
   * стрелки, Page и Home/End. Включать там, где внутри нечего фокусировать
   * (Гант) или где обзор нужен без прохода по всем карточкам (доска).
   */
  keyboard?: boolean;
}

/** Вешает протяжку на элемент. Возвращает функцию отписки. */
export function attachDragScroll(
  el: HTMLElement,
  getOptions: () => DragScrollOptions
): () => void {

  let pointerId: number | null = null;
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;
  let samples: PointerSample[] = [];
  let frame = 0;

  const axis = (): DragAxis => getOptions().axis ?? "x";
  const canX = () => axis() !== "y" && el.scrollWidth - el.clientWidth > 1;
  const canY = () => axis() !== "x" && el.scrollHeight - el.clientHeight > 1;

  /** Курсор-«рука» появляется, только если ленте есть куда ехать. */
  function markScrollable() {
    if ((canX() || canY()) && getOptions().enabled !== false) {
      el.dataset.dragScroll = "true";
    } else {
      delete el.dataset.dragScroll;
    }
    markEdges();
  }

  /**
   * Какой край ленты «растворять»: за ним есть невидимый контент.
   * Пишем в data-атрибут, маску рисует CSS — она не зависит от фона под
   * лентой (цветные колонки, персональный фон проекта, обе темы).
   */
  let edgeState = "";
  function markEdges() {
    // Каждая ось отдельно: у доски прячется контент по бокам, у колонки —
    // сверху и снизу. Ось, которую лента не прокручивает, не трогаем вовсе.
    const x =
      axis() !== "y" ? hiddenEdges(el.scrollLeft, el.scrollWidth - el.clientWidth) : "";
    const y =
      axis() !== "x" ? hiddenEdges(el.scrollTop, el.scrollHeight - el.clientHeight) : "";
    const next = `${x}|${y}`;
    if (next === edgeState) return;
    edgeState = next;
    if (x) el.dataset.scrollEdge = x;
    else delete el.dataset.scrollEdge;
    if (y) el.dataset.scrollEdgeY = y;
    else delete el.dataset.scrollEdgeY;
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
    if (getOptions().enabled === false) return;
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
    if (getOptions().momentum !== false && !reduceMotion) startMomentum(vx, vy);
  }

  // ── Автопрокрутка при нативном drag&drop ──────────────────────
  // Пока тащат карточку, указатель принадлежит браузеру и протяжка молчит.
  // Поэтому ленту у края крутим сами — иначе колонку за пределами экрана
  // ничем не достать.
  let edgeVx = 0;
  let edgeVy = 0;
  let edgeFrame = 0;
  let edgeLast = 0;
  let lastOverAt = 0;

  function stopEdgeScroll() {
    if (edgeFrame) cancelAnimationFrame(edgeFrame);
    edgeFrame = 0;
    edgeVx = 0;
    edgeVy = 0;
  }

  function edgeStep(now: number) {
    edgeFrame = 0;
    // Пока перенос идёт над лентой, dragover повторяется сам (по спецификации
    // не реже чем раз в 350 мс). Затишье дольше — перенос кончился где-то
    // мимо наших событий, и крутить дальше нечего.
    if (now - lastOverAt > 700) return;
    const dt = Math.min(now - edgeLast, 50);
    edgeLast = now;
    if (edgeVx) el.scrollLeft += edgeVx * dt;
    if (edgeVy) el.scrollTop += edgeVy * dt;
    if (edgeVx || edgeVy) edgeFrame = requestAnimationFrame(edgeStep);
  }

  function onDragOver(e: DragEvent) {
    lastOverAt = performance.now();
    const rect = el.getBoundingClientRect();
    edgeVx = canX() ? edgeScrollSpeed(e.clientX, rect.left, rect.right) : 0;
    edgeVy = canY() ? edgeScrollSpeed(e.clientY, rect.top, rect.bottom) : 0;
    if ((edgeVx || edgeVy) && !edgeFrame) {
      edgeLast = lastOverAt;
      edgeFrame = requestAnimationFrame(edgeStep);
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    // Только когда фокус на самой ленте: у карточки внутри свои клавиши
    if (e.target !== el || e.ctrlKey || e.metaKey || e.altKey) return;
    const horizontal = axis() !== "y";
    const intent = keyboardScroll(
      e.key,
      horizontal ? el.clientWidth : el.clientHeight,
      axis()
    );
    if (!intent) return;
    if (!canX() && !canY()) return;
    e.preventDefault();
    stopMomentum();
    const behavior: ScrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? "auto"
      : "smooth";
    if (intent.jump) {
      const max = horizontal
        ? el.scrollWidth - el.clientWidth
        : el.scrollHeight - el.clientHeight;
      const to = intent.jump === "start" ? 0 : max;
      el.scrollTo(horizontal ? { left: to, behavior } : { top: to, behavior });
      return;
    }
    el.scrollBy({ left: intent.dx, top: intent.dy, behavior });
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
  el.addEventListener("dragover", onDragOver);
  el.addEventListener("drop", stopEdgeScroll);
  el.addEventListener("dragend", stopEdgeScroll);
  el.addEventListener("wheel", stopMomentum, { passive: true });
  el.addEventListener("scroll", markEdges, { passive: true });
  // Лента в порядке табуляции — иначе клавиатуре её не достать. Чужой
  // tabindex не трогаем: значит, о фокусе уже позаботился вызывающий код.
  const ownTabIndex = getOptions().keyboard && !el.hasAttribute("tabindex");
  if (getOptions().keyboard) {
    el.dataset.scrollKeys = "true";
    if (ownTabIndex) el.tabIndex = 0;
    el.addEventListener("keydown", onKeyDown);
  }
  // Пересчитываем, не дожидаясь курсора: размеры самой ленты меняет окно
  // (поворот экрана, сайдбар), а её длину — появление и исчезновение
  // колонок и вкладок, которых ResizeObserver не видит.
  const sizeObserver = new ResizeObserver(markScrollable);
  sizeObserver.observe(el);
  const contentObserver = new MutationObserver(markScrollable);
  contentObserver.observe(el, { childList: true });
  markScrollable();

  // React 19 вызывает эту функцию, когда элемент уходит из DOM
  return () => {
    stopMomentum();
    stopEdgeScroll();
    reset();
    el.removeEventListener("pointerdown", onPointerDown);
    el.removeEventListener("pointermove", onPointerMove);
    el.removeEventListener("pointerup", onPointerUp);
    el.removeEventListener("pointercancel", reset);
    el.removeEventListener("pointerenter", markScrollable);
    el.removeEventListener("dragstart", onDragStart);
    el.removeEventListener("dragover", onDragOver);
    el.removeEventListener("drop", stopEdgeScroll);
    el.removeEventListener("dragend", stopEdgeScroll);
    el.removeEventListener("wheel", stopMomentum);
    el.removeEventListener("scroll", markEdges);
    el.removeEventListener("keydown", onKeyDown);
    if (ownTabIndex) el.removeAttribute("tabindex");
    delete el.dataset.scrollKeys;
    sizeObserver.disconnect();
    contentObserver.disconnect();
    delete el.dataset.dragScroll;
    delete el.dataset.scrollEdge;
    delete el.dataset.scrollEdgeY;
  };
}
