import { describe, it, expect } from "vitest";
import { HEX_COLOR, projectBackgroundCss } from "@/lib/background";

describe("projectBackgroundCss", () => {
  it("однотонный фон — радиальный градиент от цвета", () => {
    const css = projectBackgroundCss({ color: "#6366f1", colorTo: null, angle: 160 });
    expect(css).toContain("radial-gradient");
    expect(css).toContain("#6366f1");
    expect(css).not.toContain("linear-gradient");
  });

  it("градиент использует оба цвета и угол", () => {
    const css = projectBackgroundCss({
      color: "#6366f1",
      colorTo: "#ec4899",
      angle: 45,
    });
    expect(css).toContain("linear-gradient(45deg");
    expect(css).toContain("#6366f1");
    expect(css).toContain("#ec4899");
  });

  it("цвета остаются полупрозрачными — фон не перекрывает текст", () => {
    const solid = projectBackgroundCss({ color: "#ffffff", colorTo: null, angle: 0 });
    const gradient = projectBackgroundCss({
      color: "#ffffff",
      colorTo: "#000000",
      angle: 0,
    });
    // К каждому цвету добавлен альфа-канал (8 символов вместо 6)
    expect(solid).not.toMatch(/#ffffff[^0-9a-fA-F]/);
    expect(gradient).not.toMatch(/#ffffff[^0-9a-fA-F]/);
    expect(gradient).not.toMatch(/#000000[^0-9a-fA-F]/);
  });
});

describe("HEX_COLOR", () => {
  it("принимает #rrggbb и отвергает остальное", () => {
    expect(HEX_COLOR.test("#a1b2c3")).toBe(true);
    expect(HEX_COLOR.test("#ABCDEF")).toBe(true);
    expect(HEX_COLOR.test("#abc")).toBe(false);
    expect(HEX_COLOR.test("red")).toBe(false);
    expect(HEX_COLOR.test("#a1b2c3;background:url(x)")).toBe(false);
    expect(HEX_COLOR.test("")).toBe(false);
  });
});
