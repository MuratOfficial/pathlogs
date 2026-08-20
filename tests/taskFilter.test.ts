import { describe, it, expect } from "vitest";
import {
  EMPTY_FILTER,
  isFilterActive,
  matchesTaskFilter,
  parseTaskFilter,
  serializeTaskFilter,
  type FilterableTask,
} from "@/lib/taskFilter";

const task = (over: Partial<FilterableTask> = {}): FilterableTask => ({
  number: 12,
  title: "Страница оплаты",
  status: "TODO",
  type: "FEATURE",
  priority: "MEDIUM",
  assignees: [{ id: "маша" }],
  tags: [{ id: "фронт" }],
  ...over,
});

describe("matchesTaskFilter", () => {
  it("пустой фильтр пропускает всё", () => {
    expect(matchesTaskFilter(task(), EMPTY_FILTER)).toBe(true);
  });

  it("условия складываются: нужно совпасть по всем сразу", () => {
    const f = { ...EMPTY_FILTER, status: "TODO" as const, type: "FEATURE" as const };
    expect(matchesTaskFilter(task(), f)).toBe(true);
    expect(matchesTaskFilter(task({ type: "BUG" }), f)).toBe(false);
  });

  it("исполнитель и метка ищутся среди всех, а не только первого", () => {
    const t = task({ assignees: [{ id: "петя" }, { id: "маша" }], tags: [{ id: "бэк" }, { id: "фронт" }] });
    expect(matchesTaskFilter(t, { ...EMPTY_FILTER, assignee: "маша" })).toBe(true);
    expect(matchesTaskFilter(t, { ...EMPTY_FILTER, tag: "фронт" })).toBe(true);
    expect(matchesTaskFilter(t, { ...EMPTY_FILTER, assignee: "коля" })).toBe(false);
  });

  it("текст ищется и в названии, и в номере", () => {
    expect(matchesTaskFilter(task(), { ...EMPTY_FILTER, q: "оплат" })).toBe(true);
    expect(matchesTaskFilter(task(), { ...EMPTY_FILTER, q: "12" })).toBe(true);
    expect(matchesTaskFilter(task(), { ...EMPTY_FILTER, q: "отчёт" })).toBe(false);
  });

  it("регистр и лишние пробелы в поиске не мешают", () => {
    expect(matchesTaskFilter(task(), { ...EMPTY_FILTER, q: "  ОПЛАТЫ " })).toBe(true);
  });

  it("приоритет — отдельное условие", () => {
    expect(matchesTaskFilter(task({ priority: "HIGH" }), { ...EMPTY_FILTER, priority: "HIGH" })).toBe(true);
    expect(matchesTaskFilter(task({ priority: "LOW" }), { ...EMPTY_FILTER, priority: "HIGH" })).toBe(false);
  });
});

describe("разбор и сборка строки фильтра", () => {
  it("пустой фильтр сериализуется в пустую строку", () => {
    expect(serializeTaskFilter(EMPTY_FILTER)).toBe("");
    expect(isFilterActive(EMPTY_FILTER)).toBe(false);
  });

  it("строка переживает круг разбор → сборка → разбор", () => {
    const filter = {
      q: "оплата",
      status: "IN_PROGRESS" as const,
      type: "BUG" as const,
      priority: "HIGH" as const,
      assignee: "user-1",
      tag: "tag-1",
    };
    expect(parseTaskFilter(serializeTaskFilter(filter))).toEqual(filter);
  });

  it("сохранённый фильтр старого формата (без приоритета) читается", () => {
    const f = parseTaskFilter("status=TODO&assignee=user-1&q=оплата");
    expect(f.status).toBe("TODO");
    expect(f.assignee).toBe("user-1");
    expect(f.q).toBe("оплата");
    expect(f.priority).toBe("ALL");
    expect(f.tag).toBe("ALL");
  });

  it("мусор в строке не ломает фильтр", () => {
    expect(parseTaskFilter("")).toEqual(EMPTY_FILTER);
    expect(parseTaskFilter("что=то&ещё")).toEqual(EMPTY_FILTER);
  });

  it("любое заданное условие делает фильтр активным", () => {
    expect(isFilterActive({ ...EMPTY_FILTER, q: "x" })).toBe(true);
    expect(isFilterActive({ ...EMPTY_FILTER, tag: "t" })).toBe(true);
  });
});
