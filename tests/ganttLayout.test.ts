import { describe, it, expect } from "vitest";
import {
  DAY_MS,
  SCALE_PAD,
  applyDrag,
  buildScale,
  criticalPath,
  datedRows,
  deltaDays,
  layoutBars,
  startOfDay,
  toISODate,
} from "@/components/ui/gantt/ganttLayout";

// Даты без «Z»: раскладка работает в локальном времени, и тест не должен
// зависеть от часового пояса машины.
const day = (d: number) => `2026-01-${String(d).padStart(2, "0")}T12:00:00`;

describe("toISODate", () => {
  it("собирает дату из локальных частей, без сдвига в UTC", () => {
    expect(toISODate(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });
});

describe("datedRows", () => {
  it("пропускает элементы без дат и сортирует по началу", () => {
    const rows = datedRows([
      { id: "late", startDate: day(10), dueDate: day(12) },
      { id: "none" },
      { id: "early", startDate: day(3), dueDate: day(4) },
    ]);
    expect(rows.map((r) => r.item.id)).toEqual(["early", "late"]);
  });

  it("одна дата — однодневная полоса", () => {
    const [onlyDue] = datedRows([{ id: "a", dueDate: day(7) }]);
    expect(onlyDue.from.getTime()).toBe(onlyDue.to.getTime());
    const [onlyStart] = datedRows([{ id: "b", startDate: day(7) }]);
    expect(onlyStart.from.getTime()).toBe(onlyStart.to.getTime());
  });

  it("срок раньше начала схлопывается в день, а не выворачивает полосу", () => {
    const [row] = datedRows([{ id: "a", startDate: day(10), dueDate: day(5) }]);
    expect(row.to.getTime()).toBe(row.from.getTime());
  });
});

describe("buildScale", () => {
  it("на пустом плане шкалы нет", () => {
    expect(buildScale([])).toBeNull();
  });

  it("начинается с запасом слева и знает, где сегодня", () => {
    const rows = datedRows([{ id: "a", startDate: day(10), dueDate: day(12) }]);
    const scale = buildScale(rows, { today: new Date(day(11)) })!;
    expect(scale.scaleStart.getTime()).toBe(startOfDay(day(10)).getTime() - SCALE_PAD * DAY_MS);
    expect(scale.todayOffset).toBe(SCALE_PAD + 1);
    expect(scale.months[0].dayOffset).toBe(0);
  });

  it("ширина дня зависит от длины плана", () => {
    const span = (to: string) =>
      buildScale(datedRows([{ id: "a", startDate: "2026-01-01T12:00:00", dueDate: to }]))!.dayWidth;
    expect(span("2026-01-10T12:00:00")).toBe(32);
    expect(span("2026-02-20T12:00:00")).toBe(20);
    expect(span("2026-06-01T12:00:00")).toBe(12);
  });
});

describe("layoutBars", () => {
  it("смещение и длительность считаются в днях, однодневная полоса шириной в день", () => {
    const rows = datedRows([
      { id: "a", startDate: day(10), dueDate: day(12) },
      { id: "b", dueDate: day(15) },
    ]);
    const layout = layoutBars(rows, startOfDay(day(8)));
    expect(layout.get("a")).toEqual({ row: 0, offset: 2, span: 3 });
    expect(layout.get("b")).toEqual({ row: 1, offset: 7, span: 1 });
  });
});

describe("criticalPath", () => {
  const durations: Record<string, number> = { a: 2, b: 5, c: 1, d: 1 };
  const dur = (id: string) => durations[id];
  const ids = new Set(Object.keys(durations));

  it("выбирает самую длинную цепочку по суммарной длительности", () => {
    // a → b → d (8 дней) длиннее a → c → d (4 дня)
    const path = criticalPath(
      ids,
      [
        { fromId: "a", toId: "b" },
        { fromId: "a", toId: "c" },
        { fromId: "b", toId: "d" },
        { fromId: "c", toId: "d" },
      ],
      dur
    );
    expect([...path.ids].sort()).toEqual(["a", "b", "d"]);
    expect(path.previous.get("d")).toBe("b");
  });

  it("при цикле пути нет", () => {
    const path = criticalPath(
      ids,
      [
        { fromId: "a", toId: "b" },
        { fromId: "b", toId: "a" },
      ],
      dur
    );
    expect(path.ids.size).toBe(0);
  });

  it("связи с чужими элементами и петли не считаются, без связей пути нет", () => {
    const path = criticalPath(
      ids,
      [
        { fromId: "a", toId: "zzz" },
        { fromId: "c", toId: "c" },
      ],
      dur
    );
    expect(path.ids.size).toBe(0);
  });
});

describe("applyDrag", () => {
  const base = { itemId: "a", startX: 0, origFrom: 10 * DAY_MS, origTo: 14 * DAY_MS };

  it("полоса целиком едет обоими концами", () => {
    expect(applyDrag({ ...base, mode: "move", delta: 3 })).toEqual({ from: 13 * DAY_MS, to: 17 * DAY_MS });
  });

  it("левый край упирается в правый", () => {
    expect(applyDrag({ ...base, mode: "start", delta: 2 })).toEqual({ from: 12 * DAY_MS, to: 14 * DAY_MS });
    expect(applyDrag({ ...base, mode: "start", delta: 10 })).toEqual({ from: 14 * DAY_MS, to: 14 * DAY_MS });
  });

  it("правый край упирается в левый", () => {
    expect(applyDrag({ ...base, mode: "end", delta: -2 })).toEqual({ from: 10 * DAY_MS, to: 12 * DAY_MS });
    expect(applyDrag({ ...base, mode: "end", delta: -10 })).toEqual({ from: 10 * DAY_MS, to: 10 * DAY_MS });
  });
});

describe("deltaDays", () => {
  it("округляет сдвиг указателя до целых дней", () => {
    expect(deltaDays(150, 100, 32)).toBe(2);
    expect(deltaDays(110, 100, 32)).toBe(0);
    expect(deltaDays(60, 100, 20)).toBe(-2);
  });
});
