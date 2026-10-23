import { describe, it, expect } from "vitest";
import {
  applyOrder,
  columnItems,
  dropSlotIndex,
  hiddenColumns,
  hoverIndex,
  insertAt,
  isOverWipLimit,
  reorderColumns,
  visibleColumns,
  type KanbanColumnLike,
  type KanbanItemLike,
} from "@/components/ui/kanban/kanbanOrder";

const item = (id: string, columnId: string | null, order: number, createdAt: string): KanbanItemLike => ({
  id,
  columnId,
  order,
  createdAt,
});

const items = [
  item("a", "todo", 2, "2026-01-03T00:00:00Z"),
  item("b", "todo", 0, "2026-01-01T00:00:00Z"),
  item("c", "todo", 1, "2026-01-02T00:00:00Z"),
  item("d", "done", 0, "2026-01-04T00:00:00Z"),
];

describe("visibleColumns / hiddenColumns", () => {
  const columns: KanbanColumnLike[] = [
    { id: "done", order: 2 },
    { id: "todo", order: 0 },
    { id: "later", order: 1, hidden: true },
  ];

  it("показывают колонки по порядку и делят их на видимые и скрытые", () => {
    expect(visibleColumns(columns).map((c) => c.id)).toEqual(["todo", "done"]);
    expect(hiddenColumns(columns).map((c) => c.id)).toEqual(["later"]);
  });

  it("не трогают входной массив", () => {
    visibleColumns(columns);
    expect(columns.map((c) => c.id)).toEqual(["done", "todo", "later"]);
  });
});

describe("columnItems", () => {
  it("ручной порядок — по полю order", () => {
    expect(columnItems(items, { id: "todo", order: 0 }).map((t) => t.id)).toEqual(["b", "c", "a"]);
  });

  it("по дате создания — в обе стороны", () => {
    expect(columnItems(items, { id: "todo", order: 0, sort: "CREATED_DESC" }).map((t) => t.id)).toEqual(["a", "c", "b"]);
    expect(columnItems(items, { id: "todo", order: 0, sort: "CREATED_ASC" }).map((t) => t.id)).toEqual(["b", "c", "a"]);
  });

  it("берёт только карточки своей колонки и не мутирует вход", () => {
    const before = items.map((t) => t.id);
    expect(columnItems(items, { id: "done", order: 1 }).map((t) => t.id)).toEqual(["d"]);
    expect(items.map((t) => t.id)).toEqual(before);
  });
});

describe("dropSlotIndex", () => {
  const list = columnItems(items, { id: "todo", order: 0, sort: "CREATED_ASC" });

  it("при ручном порядке слот под курсором, но в границах списка", () => {
    const column = { id: "todo", order: 0 };
    expect(dropSlotIndex({ column, list, hovered: 1, dragged: null })).toBe(1);
    expect(dropSlotIndex({ column, list, hovered: -5, dragged: null })).toBe(0);
    expect(dropSlotIndex({ column, list, hovered: 99, dragged: null })).toBe(list.length);
  });

  it("при активном фильтре — всегда в конец", () => {
    expect(dropSlotIndex({ column: { id: "todo", order: 0 }, list, hovered: 0, dragged: null, filtering: true })).toBe(
      list.length
    );
  });

  it("при сортировке по дате — туда, где карточка окажется на самом деле", () => {
    const dragged = item("x", "done", 0, "2026-01-02T12:00:00Z");
    expect(dropSlotIndex({ column: { id: "todo", order: 0, sort: "CREATED_ASC" }, list, hovered: 0, dragged })).toBe(2);
    const desc = columnItems(items, { id: "todo", order: 0, sort: "CREATED_DESC" });
    expect(
      dropSlotIndex({ column: { id: "todo", order: 0, sort: "CREATED_DESC" }, list: desc, hovered: 0, dragged })
    ).toBe(1);
  });

  it("самая новая карточка при сортировке по возрастанию встаёт в конец", () => {
    const dragged = item("x", "done", 0, "2027-01-01T00:00:00Z");
    expect(dropSlotIndex({ column: { id: "todo", order: 0, sort: "CREATED_ASC" }, list, hovered: 0, dragged })).toBe(
      list.length
    );
  });
});

describe("insertAt", () => {
  it("вставляет id на позицию, убирая его прежнее место", () => {
    expect(insertAt(["a", "b", "c"], "a", 2)).toEqual(["b", "c", "a"]);
    expect(insertAt(["a", "b"], "x", 1)).toEqual(["a", "x", "b"]);
  });

  it("зажимает позицию в границы списка", () => {
    expect(insertAt(["a", "b"], "x", -3)).toEqual(["x", "a", "b"]);
    expect(insertAt(["a", "b"], "x", 10)).toEqual(["a", "b", "x"]);
  });
});

describe("reorderColumns", () => {
  it("ставит перетаскиваемую колонку на место целевой", () => {
    expect(reorderColumns(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
    expect(reorderColumns(["a", "b", "c"], "a", "c")).toEqual(["b", "a", "c"]);
  });

  it("бросок на саму себя и на неизвестную колонку ничего не меняет", () => {
    const ids = ["a", "b"];
    expect(reorderColumns(ids, "a", "a")).toBe(ids);
    expect(reorderColumns(ids, "a", "zzz")).toBe(ids);
  });
});

describe("isOverWipLimit", () => {
  it("превышение — только строго больше лимита", () => {
    expect(isOverWipLimit(3, 3)).toBe(false);
    expect(isOverWipLimit(4, 3)).toBe(true);
  });

  it("без лимита превышения не бывает", () => {
    expect(isOverWipLimit(100, null)).toBe(false);
    expect(isOverWipLimit(100, undefined)).toBe(false);
  });

  it("лимит 0 — это лимит, а не его отсутствие", () => {
    expect(isOverWipLimit(1, 0)).toBe(true);
  });
});

describe("hoverIndex", () => {
  it("верхняя половина карточки — перед ней, нижняя — после", () => {
    expect(hoverIndex(2, 110, 100, 40)).toBe(2);
    expect(hoverIndex(2, 130, 100, 40)).toBe(3);
  });
});

describe("applyOrder", () => {
  it("переносит карточки в колонку и нумерует их по новому порядку", () => {
    const next = applyOrder(items, "done", ["a", "d"]);
    expect(next.find((t) => t.id === "a")).toMatchObject({ columnId: "done", order: 0 });
    expect(next.find((t) => t.id === "d")).toMatchObject({ columnId: "done", order: 1 });
  });

  it("карточки, которых нет в новом порядке, остаются как были", () => {
    const next = applyOrder(items, "done", ["a"]);
    expect(next.find((t) => t.id === "b")).toBe(items.find((t) => t.id === "b"));
  });
});
