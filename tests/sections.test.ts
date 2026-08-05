import { describe, it, expect } from "vitest";
import { activeSectionId } from "@/lib/sections";

// Линия — низ липкой панели; top отрицательный, когда блок ушёл выше неё
const LINE = 70;

describe("activeSectionId", () => {
  const positions = [
    { id: "overview", top: -400 },
    { id: "checklist", top: -120 },
    { id: "links", top: 300 },
    { id: "files", top: 700 },
  ];

  it("активен последний блок, прошедший линию", () => {
    expect(activeSectionId(positions, LINE, false)).toBe("checklist");
  });

  it("в самом верху активен первый блок", () => {
    const top = [
      { id: "overview", top: 0 },
      { id: "checklist", top: 500 },
    ];
    expect(activeSectionId(top, LINE, false)).toBe("overview");
  });

  it("блок ровно на линии уже считается активным", () => {
    expect(
      activeSectionId([{ id: "a", top: 0 }, { id: "b", top: LINE }], LINE, false)
    ).toBe("b");
  });

  it("у низа страницы активен последний блок, даже если он не дошёл до линии", () => {
    // Короткие блоки в конце страницы физически не поднимаются к линии
    expect(activeSectionId(positions, LINE, true)).toBe("files");
  });

  it("пустой список не ломает подсветку", () => {
    expect(activeSectionId([], LINE, false)).toBeNull();
    expect(activeSectionId([], LINE, true)).toBeNull();
  });
});
