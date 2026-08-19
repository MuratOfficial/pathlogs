import { describe, it, expect } from "vitest";
import {
  DRAG_THRESHOLD,
  EDGE_MAX_SPEED,
  EDGE_ZONE,
  KEY_PAGE_RATIO,
  KEY_STEP_MAX,
  KEY_STEP_MIN,
  KEY_STEP_RATIO,
  MAX_VELOCITY,
  MIN_VELOCITY,
  decayVelocity,
  edgeScrollSpeed,
  flingVelocity,
  hiddenEdges,
  isDragIntent,
  keyboardScroll,
} from "@/lib/dragScroll";

describe("isDragIntent", () => {
  it("мелкое дрожание руки остаётся кликом", () => {
    expect(isDragIntent(2, 2, "x")).toBe(false);
    expect(isDragIntent(0, 0, "both")).toBe(false);
  });

  it("на горизонтальной ленте считается только сдвиг по X", () => {
    expect(isDragIntent(1, 40, "x")).toBe(false);
    expect(isDragIntent(-40, 1, "x")).toBe(true);
  });

  it("по обеим осям берётся длина вектора", () => {
    expect(isDragIntent(3, 4, "both", 5)).toBe(true);
    expect(isDragIntent(3, 3, "both", 5)).toBe(false);
  });

  it("сдвиг ровно на порог уже протяжка", () => {
    expect(isDragIntent(DRAG_THRESHOLD, 0, "x")).toBe(true);
  });
});

describe("flingVelocity", () => {
  it("пустой и одноточечный трек — без броска", () => {
    expect(flingVelocity([], 10)).toEqual({ vx: 0, vy: 0 });
    expect(flingVelocity([{ t: 10, x: 5, y: 5 }], 10)).toEqual({ vx: 0, vy: 0 });
  });

  it("скорость — это путь за время в px/мс", () => {
    const v = flingVelocity(
      [
        { t: 0, x: 0, y: 0 },
        { t: 50, x: 100, y: -25 },
      ],
      50
    );
    expect(v.vx).toBeCloseTo(2);
    expect(v.vy).toBeCloseTo(-0.5);
  });

  it("точки старее окна не учитываются", () => {
    // Долгая протяжка в начале жеста не должна раздувать бросок
    const v = flingVelocity(
      [
        { t: 0, x: 0, y: 0 },
        { t: 900, x: 0, y: 0 },
        { t: 950, x: 100, y: 0 },
      ],
      950,
      90
    );
    expect(v.vx).toBeCloseTo(2);
  });

  it("довели, подержали и отпустили — инерции нет", () => {
    const samples = [
      { t: 0, x: 0, y: 0 },
      { t: 40, x: 200, y: 0 },
      { t: 80, x: 200, y: 0 },
    ];
    expect(flingVelocity(samples, 400)).toEqual({ vx: 0, vy: 0 });
  });

  it("короткая пауза перед отпусканием ослабляет бросок", () => {
    const samples = [
      { t: 0, x: 0, y: 0 },
      { t: 40, x: 100, y: 0 },
    ];
    expect(flingVelocity(samples, 80).vx).toBeLessThan(flingVelocity(samples, 40).vx);
  });

  it("рывок ограничен потолком скорости", () => {
    const v = flingVelocity(
      [
        { t: 0, x: 0, y: 0 },
        { t: 1, x: 5000, y: -5000 },
      ],
      1
    );
    expect(v.vx).toBe(MAX_VELOCITY);
    expect(v.vy).toBe(-MAX_VELOCITY);
  });
});

describe("decayVelocity", () => {
  it("скорость падает со временем и не меняет знак", () => {
    const v = decayVelocity(-2, 16.7);
    expect(v).toBeLessThan(0);
    expect(Math.abs(v)).toBeLessThan(2);
  });

  it("длинный кадр тормозит сильнее короткого", () => {
    expect(decayVelocity(2, 33)).toBeLessThan(decayVelocity(2, 16.7));
  });

  it("у порога скорость обнуляется — лента не ползёт бесконечно", () => {
    expect(decayVelocity(MIN_VELOCITY, 16.7)).toBe(0);
    expect(decayVelocity(0, 16.7)).toBe(0);
  });

  it("бросок затухает за разумное время (< 2 с)", () => {
    let v = MAX_VELOCITY;
    let frames = 0;
    while (v !== 0 && frames < 600) {
      v = decayVelocity(v, 16.7);
      frames += 1;
    }
    expect(v).toBe(0);
    expect(frames * 16.7).toBeLessThan(2000);
  });
});

describe("edgeScrollSpeed", () => {
  // Лента шириной 1000 px, зона у края — 100 px
  const L = 0;
  const R = 1000;
  const Z = 100;

  it("в середине ленты автопрокрутки нет", () => {
    expect(edgeScrollSpeed(500, L, R, Z)).toBe(0);
    expect(edgeScrollSpeed(L + Z, L, R, Z)).toBe(0);
    expect(edgeScrollSpeed(R - Z, L, R, Z)).toBe(0);
  });

  it("у левого края лента едет к началу, у правого — к концу", () => {
    expect(edgeScrollSpeed(L + 20, L, R, Z)).toBeLessThan(0);
    expect(edgeScrollSpeed(R - 20, L, R, Z)).toBeGreaterThan(0);
  });

  it("чем ближе к краю, тем быстрее", () => {
    const far = Math.abs(edgeScrollSpeed(L + 80, L, R, Z));
    const near = Math.abs(edgeScrollSpeed(L + 10, L, R, Z));
    expect(near).toBeGreaterThan(far);
  });

  it("у самой границы и за пределами ленты — полная скорость", () => {
    expect(edgeScrollSpeed(L, L, R, Z, EDGE_MAX_SPEED)).toBe(-EDGE_MAX_SPEED);
    expect(edgeScrollSpeed(L - 300, L, R, Z, EDGE_MAX_SPEED)).toBe(-EDGE_MAX_SPEED);
    expect(edgeScrollSpeed(R + 300, L, R, Z, EDGE_MAX_SPEED)).toBe(EDGE_MAX_SPEED);
  });

  it("у узкой ленты зона ужимается — середина остаётся нейтральной", () => {
    // Ширина 60 px при зоне 72 px: иначе зоны сомкнулись бы и лента ехала всегда
    expect(edgeScrollSpeed(30, 0, 60, EDGE_ZONE)).toBe(0);
    expect(edgeScrollSpeed(5, 0, 60, EDGE_ZONE)).toBeLessThan(0);
    expect(edgeScrollSpeed(55, 0, 60, EDGE_ZONE)).toBeGreaterThan(0);
  });

  it("вырожденная лента не двигается", () => {
    expect(edgeScrollSpeed(10, 100, 100)).toBe(0);
    expect(edgeScrollSpeed(10, 100, 50)).toBe(0);
  });
});

describe("hiddenEdges", () => {
  it("лента помещается целиком — растворять нечего", () => {
    expect(hiddenEdges(0, 0)).toBe("");
    expect(hiddenEdges(0, 1)).toBe("");
  });

  it("в начале ленты продолжение справа, в конце — слева", () => {
    expect(hiddenEdges(0, 500)).toBe("end");
    expect(hiddenEdges(500, 500)).toBe("start");
  });

  it("в середине растворяются оба края", () => {
    expect(hiddenEdges(250, 500)).toBe("both");
  });

  it("дробная прокрутка у самого края не мигает подсказкой", () => {
    expect(hiddenEdges(0.4, 500)).toBe("end");
    expect(hiddenEdges(499.6, 500)).toBe("start");
  });
});

describe("keyboardScroll", () => {
  const VIEW = 800; // видимая часть ленты

  it("стрелки двигают ленту вдоль её оси", () => {
    const right = keyboardScroll("ArrowRight", VIEW, "x");
    const left = keyboardScroll("ArrowLeft", VIEW, "x");
    expect(right!.dx).toBeGreaterThan(0);
    expect(left!.dx).toBe(-right!.dx);
    expect(right!.dy).toBe(0);
  });

  it("клавиши поперёк оси не перехватываются — их ждёт страница", () => {
    expect(keyboardScroll("ArrowDown", VIEW, "x")).toBeNull();
    expect(keyboardScroll("ArrowUp", VIEW, "x")).toBeNull();
    expect(keyboardScroll("ArrowLeft", VIEW, "y")).toBeNull();
  });

  it("по обеим осям работают все четыре стрелки", () => {
    expect(keyboardScroll("ArrowRight", VIEW, "both")!.dx).toBeGreaterThan(0);
    expect(keyboardScroll("ArrowDown", VIEW, "both")!.dy).toBeGreaterThan(0);
  });

  it("шаг соразмерен ленте, но не выходит за границы разумного", () => {
    expect(keyboardScroll("ArrowRight", VIEW, "x")!.dx).toBeCloseTo(VIEW * KEY_STEP_RATIO);
    // Узкая лента: шаг не меньше минимума, иначе прокрутка еле ползёт
    expect(keyboardScroll("ArrowRight", 100, "x")!.dx).toBe(KEY_STEP_MIN);
    // Огромная лента: шаг не больше максимума, иначе прыжок через полэкрана
    expect(keyboardScroll("ArrowRight", 4000, "x")!.dx).toBe(KEY_STEP_MAX);
  });

  it("Page двигает почти на экран и заметно больше стрелки", () => {
    const page = keyboardScroll("PageDown", VIEW, "x")!.dx;
    expect(page).toBeCloseTo(VIEW * KEY_PAGE_RATIO);
    expect(page).toBeGreaterThan(keyboardScroll("ArrowRight", VIEW, "x")!.dx);
    expect(keyboardScroll("PageUp", VIEW, "x")!.dx).toBe(-page);
  });

  it("Home и End прыгают к краям", () => {
    expect(keyboardScroll("Home", VIEW, "x")!.jump).toBe("start");
    expect(keyboardScroll("End", VIEW, "x")!.jump).toBe("end");
  });

  it("посторонние клавиши лента не трогает", () => {
    for (const key of ["a", "Enter", "Escape", "Tab", " ", "d"]) {
      expect(keyboardScroll(key, VIEW, "x")).toBeNull();
    }
  });
});
