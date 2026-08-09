import { describe, it, expect } from "vitest";
import {
  DRAG_THRESHOLD,
  MAX_VELOCITY,
  MIN_VELOCITY,
  decayVelocity,
  flingVelocity,
  isDragIntent,
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
