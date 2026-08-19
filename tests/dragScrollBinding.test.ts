import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { attachDragScroll, type DragScrollOptions } from "@/lib/dragScrollBinding";

/**
 * Поддельная лента: реального DOM в тестах нет (окружение node), да он и не
 * нужен — важно поведение привязки, а не вёрстка. Здесь всё, чего она касается:
 * слушатели, прокрутка, размеры, dataset и захват указателя.
 */
function fakeStrip({ content = 2000, view = 500, height = 300, contentHeight = 300 } = {}) {
  const listeners = new Map<string, Set<(e: unknown) => void>>();
  const el = {
    scrollLeft: 0,
    scrollTop: 0,
    scrollWidth: content,
    clientWidth: view,
    scrollHeight: contentHeight,
    clientHeight: height,
    dataset: {} as Record<string, string>,
    tabIndex: -1,
    classList: {
      names: new Set<string>(),
      add(n: string) {
        this.names.add(n);
      },
      remove(n: string) {
        this.names.delete(n);
      },
      contains(n: string) {
        return this.names.has(n);
      },
    },
    addEventListener(type: string, fn: (e: unknown) => void) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener(type: string, fn: (e: unknown) => void) {
      listeners.get(type)?.delete(fn);
    },
    // Сама лента ни под один «не трогать» селектор не подходит
    closest: () => null,
    hasAttribute: () => false,
    removeAttribute: vi.fn(),
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    hasPointerCapture: () => true,
    getBoundingClientRect: () => ({ left: 0, right: view, top: 0, bottom: height }),
    scrollBy({ left = 0, top = 0 }: { left?: number; top?: number }) {
      el.scrollLeft += left;
      el.scrollTop += top;
    },
    scrollTo({ left, top }: { left?: number; top?: number }) {
      if (left !== undefined) el.scrollLeft = left;
      if (top !== undefined) el.scrollTop = top;
    },
  };
  return {
    el: el as unknown as HTMLElement,
    raw: el,
    listenerCount: () => [...listeners.values()].reduce((n, s) => n + s.size, 0),
    /** Отправляет событие всем подписчикам — как это сделал бы браузер. */
    fire(type: string, event: Record<string, unknown> = {}) {
      const e = {
        type,
        target: el,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        ...event,
      };
      listeners.get(type)?.forEach((fn) => fn(e));
      return e;
    },
    has: (type: string) => (listeners.get(type)?.size ?? 0) > 0,
  };
}

/** Событие указателя: мышь, левая кнопка; время растёт вместе с координатой. */
function pointer(x: number, y = 50, extra: Record<string, unknown> = {}) {
  return {
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    buttons: 1,
    clientX: x,
    clientY: y,
    timeStamp: x,
    ...extra,
  };
}

let frames: ((t: number) => void)[] = [];
let now = 0;

beforeEach(() => {
  frames = [];
  now = 0;
  // Кадры и глобальные объекты браузера, которых в node нет
  vi.stubGlobal("requestAnimationFrame", (cb: (t: number) => void) => frames.push(cb));
  vi.stubGlobal("cancelAnimationFrame", () => {});
  vi.stubGlobal("performance", { now: () => now });
  vi.stubGlobal("window", {
    getSelection: () => ({ removeAllRanges() {} }),
    matchMedia: () => ({ matches: false }),
  });
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    disconnect() {}
  });
  vi.stubGlobal("MutationObserver", class {
    observe() {}
    disconnect() {}
  });
});

afterEach(() => vi.unstubAllGlobals());

/** Прокручивает очередь кадров: `count` шагов по 16 мс. */
function runFrames(count: number) {
  for (let i = 0; i < count && frames.length; i++) {
    const batch = frames;
    frames = [];
    now += 16;
    batch.forEach((cb) => cb(now));
  }
}

function attach(opts: DragScrollOptions = {}) {
  const strip = fakeStrip();
  const detach = attachDragScroll(strip.el, () => opts);
  return { ...strip, detach };
}

describe("attachDragScroll: протяжка", () => {
  it("мелкий сдвиг остаётся кликом — лента не двигается", () => {
    const s = attach();
    s.fire("pointerdown", pointer(100));
    s.fire("pointermove", pointer(97));
    expect(s.raw.scrollLeft).toBe(0);
    expect(s.raw.classList.contains("drag-scrolling")).toBe(false);
  });

  it("после порога лента едет за курсором", () => {
    const s = attach();
    s.fire("pointerdown", pointer(300));
    s.fire("pointermove", pointer(280));
    expect(s.raw.scrollLeft).toBe(20);
    expect(s.raw.classList.contains("drag-scrolling")).toBe(true);
    s.fire("pointermove", pointer(200));
    expect(s.raw.scrollLeft).toBe(100);
  });

  it("протяжка гасит клик, который браузер выдаст следом", () => {
    const s = attach();
    s.fire("pointerdown", pointer(300));
    s.fire("pointermove", pointer(200));
    s.fire("pointerup", pointer(200, 50, { buttons: 0 }));
    expect(s.has("click")).toBe(true);
    const click = s.fire("click");
    expect(click.stopPropagation).toHaveBeenCalled();
  });

  it("клик без протяжки не гасится", () => {
    const s = attach();
    s.fire("pointerdown", pointer(300));
    s.fire("pointermove", pointer(298));
    s.fire("pointerup", pointer(298, 50, { buttons: 0 }));
    expect(s.has("click")).toBe(false);
  });

  it("палец не перехватываем — на тач-экране прокрутка родная", () => {
    const s = attach();
    s.fire("pointerdown", pointer(300, 50, { pointerType: "touch" }));
    s.fire("pointermove", pointer(100, 50, { pointerType: "touch" }));
    expect(s.raw.scrollLeft).toBe(0);
  });

  it("правая кнопка мыши ленту не тянет", () => {
    const s = attach();
    s.fire("pointerdown", pointer(300, 50, { button: 2 }));
    s.fire("pointermove", pointer(100));
    expect(s.raw.scrollLeft).toBe(0);
  });

  it("на полях ввода зажатие оставляем выделению текста", () => {
    const s = attach();
    const input = { closest: (sel: string) => (sel.includes("input") ? {} : null) };
    s.fire("pointerdown", { ...pointer(300), target: input });
    s.fire("pointermove", pointer(100));
    expect(s.raw.scrollLeft).toBe(0);
  });

  it("enabled: false выключает и протяжку, и курсор-руку", () => {
    const strip = fakeStrip();
    attachDragScroll(strip.el, () => ({ enabled: false }));
    strip.fire("pointerdown", pointer(300));
    strip.fire("pointermove", pointer(100));
    expect(strip.raw.scrollLeft).toBe(0);
    expect(strip.raw.dataset.dragScroll).toBeUndefined();
  });

  it("после броска лента доезжает по инерции и останавливается", () => {
    const s = attach();
    // Время идёт вперёд по ходу жеста — из него и считается скорость броска
    s.fire("pointerdown", pointer(400, 50, { timeStamp: 0 }));
    s.fire("pointermove", pointer(340, 50, { timeStamp: 16 }));
    s.fire("pointermove", pointer(300, 50, { timeStamp: 32 }));
    const atRelease = s.raw.scrollLeft;
    s.fire("pointerup", pointer(300, 50, { buttons: 0, timeStamp: 40 }));
    runFrames(3);
    expect(s.raw.scrollLeft).toBeGreaterThan(atRelease);
    runFrames(200);
    const stopped = s.raw.scrollLeft;
    runFrames(10);
    expect(s.raw.scrollLeft).toBe(stopped);
  });
});

describe("attachDragScroll: нативный drag&drop", () => {
  it("dragstart отменяет протяжку — карточку тащим, а не ленту", () => {
    const s = attach();
    s.fire("pointerdown", pointer(300));
    s.fire("pointermove", pointer(260));
    const beforeDnd = s.raw.scrollLeft;
    s.fire("dragstart");
    s.fire("pointermove", pointer(100));
    expect(s.raw.scrollLeft).toBe(beforeDnd);
    expect(s.raw.classList.contains("drag-scrolling")).toBe(false);
  });

  it("карточка у края ленты подкручивает её, в середине — нет", () => {
    const s = attach();
    s.fire("dragover", { clientX: 250, clientY: 50 });
    runFrames(5);
    expect(s.raw.scrollLeft).toBe(0);

    s.fire("dragover", { clientX: 495, clientY: 50 });
    runFrames(5);
    expect(s.raw.scrollLeft).toBeGreaterThan(0);
  });

  it("после броска автопрокрутка гаснет", () => {
    const s = attach();
    s.fire("dragover", { clientX: 495, clientY: 50 });
    runFrames(3);
    const atDrop = s.raw.scrollLeft;
    s.fire("dragend");
    runFrames(10);
    expect(s.raw.scrollLeft).toBe(atDrop);
  });

  it("перенос оборвался без dragend — прокрутка не остаётся вечной", () => {
    const s = attach();
    s.fire("dragover", { clientX: 495, clientY: 50 });
    runFrames(10);
    const rolled = s.raw.scrollLeft;
    expect(rolled).toBeGreaterThan(0);
    now += 1000; // тишина дольше страховочного порога
    runFrames(10);
    expect(s.raw.scrollLeft).toBe(rolled);
  });
});

describe("attachDragScroll: подсказки и клавиатура", () => {
  it("курсор-рука и растворение края — только когда есть куда ехать", () => {
    const s = attach();
    expect(s.raw.dataset.dragScroll).toBe("true");
    expect(s.raw.dataset.scrollEdge).toBe("end");

    s.raw.scrollLeft = 1500;
    s.fire("scroll");
    expect(s.raw.dataset.scrollEdge).toBe("start");
  });

  it("вертикальная лента растворяет верх и низ, а не бока", () => {
    const strip = fakeStrip({ content: 400, view: 400, height: 300, contentHeight: 900 });
    attachDragScroll(strip.el, () => ({ axis: "y" }));
    expect(strip.raw.dataset.scrollEdgeY).toBe("end");
    expect(strip.raw.dataset.scrollEdge).toBeUndefined();

    strip.raw.scrollTop = 300;
    strip.fire("scroll");
    expect(strip.raw.dataset.scrollEdgeY).toBe("both");

    strip.raw.scrollTop = 600;
    strip.fire("scroll");
    expect(strip.raw.dataset.scrollEdgeY).toBe("start");
  });

  it("по обеим осям растворяются оба направления сразу", () => {
    const strip = fakeStrip({ content: 2000, view: 500, height: 300, contentHeight: 900 });
    attachDragScroll(strip.el, () => ({ axis: "both" }));
    strip.raw.scrollLeft = 700;
    strip.raw.scrollTop = 300;
    strip.fire("scroll");
    expect(strip.raw.dataset.scrollEdge).toBe("both");
    expect(strip.raw.dataset.scrollEdgeY).toBe("both");
  });

  it("узкой ленте подсказки не нужны", () => {
    const strip = fakeStrip({ content: 400, view: 400 });
    attachDragScroll(strip.el, () => ({}));
    expect(strip.raw.dataset.dragScroll).toBeUndefined();
    expect(strip.raw.dataset.scrollEdge).toBeUndefined();
  });

  it("без keyboard лента не попадает в порядок табуляции", () => {
    const s = attach();
    expect(s.raw.tabIndex).toBe(-1);
    expect(s.has("keydown")).toBe(false);
  });

  it("с keyboard стрелки и Home/End двигают ленту", () => {
    const s = attach({ keyboard: true });
    expect(s.raw.tabIndex).toBe(0);
    s.fire("keydown", { key: "ArrowRight" });
    expect(s.raw.scrollLeft).toBeGreaterThan(0);
    s.fire("keydown", { key: "End" });
    expect(s.raw.scrollLeft).toBe(1500);
    s.fire("keydown", { key: "Home" });
    expect(s.raw.scrollLeft).toBe(0);
  });

  it("клавиши карточки внутри ленты не перехватываются", () => {
    const s = attach({ keyboard: true });
    const card = {};
    const e = s.fire("keydown", { key: "ArrowRight", target: card });
    expect(s.raw.scrollLeft).toBe(0);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });
});

describe("attachDragScroll: отписка", () => {
  it("снимает слушатели и следы с элемента", () => {
    const s = attach({ keyboard: true });
    expect(s.listenerCount()).toBeGreaterThan(0);
    s.detach();
    expect(s.listenerCount()).toBe(0);
    expect(s.raw.dataset.dragScroll).toBeUndefined();
    expect(s.raw.dataset.scrollEdge).toBeUndefined();
    expect(s.raw.dataset.scrollKeys).toBeUndefined();
  });
});
