import { describe, it, expect } from "vitest";
import {
  decodeScroll,
  encodeScroll,
  scrollStorageKey,
} from "@/components/ui/scrollMemory";

describe("scrollStorageKey", () => {
  it("кладёт записи под общий префикс", () => {
    expect(scrollStorageKey("project:abc:board")).toBe("pl:scroll:project:abc:board");
  });
});

describe("encodeScroll", () => {
  it("округляет пиксели — дробей всё равно не видно", () => {
    expect(encodeScroll({ left: 120.4, top: 8.6 })).toBe("120,9");
  });
});

describe("decodeScroll", () => {
  it("читает своё же представление", () => {
    expect(decodeScroll("120,9")).toEqual({ left: 120, top: 9 });
  });

  it("пустая память — это отсутствие памяти", () => {
    expect(decodeScroll(null)).toBeNull();
    expect(decodeScroll("")).toBeNull();
  });

  it("начало ленты не восстанавливаем: это и есть значение по умолчанию", () => {
    expect(decodeScroll("0,0")).toBeNull();
  });

  it("мусор и отрицательные значения игнорируются", () => {
    expect(decodeScroll("abc")).toBeNull();
    expect(decodeScroll("120")).toBeNull();
    expect(decodeScroll("-5,10")).toBeNull();
  });
});
