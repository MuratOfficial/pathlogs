import { describe, it, expect } from "vitest";
import { shouldOfferUndo, snapshotMove, type MovableItem } from "@/lib/boardUndo";

const BOARD: MovableItem[] = [
  { id: "a", columnId: "todo", order: 0, title: "Первая" },
  { id: "b", columnId: "todo", order: 2, title: "Третья" },
  { id: "c", columnId: "todo", order: 1, title: "Вторая" },
  { id: "d", columnId: "doing", order: 0, title: "В работе" },
];

describe("snapshotMove", () => {
  it("запоминает исходную колонку карточки", () => {
    expect(snapshotMove(BOARD, "b")?.columnId).toBe("todo");
  });

  it("сохраняет порядок соседей, а не порядок в массиве", () => {
    // Массив пришёл вперемешку; вернуть карточку надо туда, где она стояла
    // на экране, иначе «Вернуть» уронит её в конец колонки.
    expect(snapshotMove(BOARD, "b")?.orderedIds).toEqual(["a", "c", "b"]);
  });

  it("включает саму перенесённую карточку в порядок", () => {
    expect(snapshotMove(BOARD, "b")?.orderedIds).toContain("b");
  });

  it("не трогает карточки других колонок", () => {
    expect(snapshotMove(BOARD, "d")?.orderedIds).toEqual(["d"]);
  });

  it("берёт название для подписи «Вернуть»", () => {
    expect(snapshotMove(BOARD, "c")?.title).toBe("Вторая");
  });

  it("на неизвестной карточке возвращает null", () => {
    // Такое бывает, когда карточку отфильтровали: предлагать отмену того,
    // чего мы не видели, нельзя.
    expect(snapshotMove(BOARD, "нет-такой")).toBeNull();
  });
});

describe("shouldOfferUndo", () => {
  it("предлагает отмену при смене колонки", () => {
    expect(shouldOfferUndo(snapshotMove(BOARD, "b"), "doing")).toBe(true);
  });

  it("молчит при перестановке внутри колонки", () => {
    // Иначе всплывашка появлялась бы после каждого перетаскивания и
    // перестала бы читаться там, где действительно нужна.
    expect(shouldOfferUndo(snapshotMove(BOARD, "b"), "todo")).toBe(false);
  });

  it("молчит, когда снимка нет", () => {
    expect(shouldOfferUndo(null, "doing")).toBe(false);
  });
});
