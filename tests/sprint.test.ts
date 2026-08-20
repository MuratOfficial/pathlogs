import { describe, it, expect } from "vitest";
import { buildBurndown, sprintProgress, sprintScope, type SprintTask } from "@/lib/sprint";

const НАЧАЛО = "2026-08-17";
const КОНЕЦ = "2026-08-21"; // спринт на 5 дней

const task = (over: Partial<SprintTask> = {}): SprintTask => ({
  status: "TODO",
  estimateHours: null,
  closedAt: null,
  ...over,
});

describe("sprintScope", () => {
  it("без оценок объём считается в задачах", () => {
    expect(sprintScope([task(), task()])).toEqual({ total: 2, unit: "задачи" });
  });

  it("когда оценки есть у всех — объём в часах", () => {
    const scope = sprintScope([task({ estimateHours: 3 }), task({ estimateHours: 5 })]);
    expect(scope).toEqual({ total: 8, unit: "часы" });
  });

  it("оценки не у всех — считаем в задачах, иначе объём занижен", () => {
    expect(sprintScope([task({ estimateHours: 8 }), task()]).unit).toBe("задачи");
  });

  it("пустой спринт — нулевой объём", () => {
    expect(sprintScope([])).toEqual({ total: 0, unit: "задачи" });
  });
});

describe("buildBurndown", () => {
  it("точка на каждый день спринта, включая первый и последний", () => {
    const points = buildBurndown([task()], НАЧАЛО, КОНЕЦ, new Date("2026-08-21T12:00:00"));
    expect(points).toHaveLength(5);
    expect(points[0]!.date).toBe("2026-08-17");
    expect(points[4]!.date).toBe("2026-08-21");
  });

  it("идеальная линия идёт от объёма до нуля", () => {
    const points = buildBurndown([task(), task(), task(), task()], НАЧАЛО, КОНЕЦ);
    expect(points[0]!.ideal).toBe(4);
    expect(points[4]!.ideal).toBe(0);
  });

  it("закрытая задача перестаёт висеть со дня закрытия", () => {
    const tasks = [task({ status: "DONE", closedAt: "2026-08-19T15:00:00" }), task()];
    const points = buildBurndown(tasks, НАЧАЛО, КОНЕЦ, new Date("2026-08-21T12:00:00"));
    expect(points[1]!.remaining).toBe(2); // 18-е: ещё обе
    expect(points[2]!.remaining).toBe(1); // 19-е: одну закрыли
    expect(points[4]!.remaining).toBe(1);
  });

  it("будущие дни остаются пустыми — линия не забегает вперёд", () => {
    const points = buildBurndown([task()], НАЧАЛО, КОНЕЦ, new Date("2026-08-18T12:00:00"));
    expect(points[1]!.remaining).toBe(1);
    expect(points[2]!.remaining).toBeNull();
    expect(points[4]!.remaining).toBeNull();
  });

  it("в часовом спринте сгорают часы, а не штуки", () => {
    const tasks = [
      task({ estimateHours: 6, status: "DONE", closedAt: "2026-08-18T10:00:00" }),
      task({ estimateHours: 4 }),
    ];
    const points = buildBurndown(tasks, НАЧАЛО, КОНЕЦ, new Date("2026-08-21T12:00:00"));
    expect(points[0]!.remaining).toBe(10);
    expect(points[1]!.remaining).toBe(4);
  });

  it("однодневный спринт не ломает расчёт", () => {
    const points = buildBurndown([task()], НАЧАЛО, НАЧАЛО, new Date("2026-08-17T12:00:00"));
    expect(points).toHaveLength(1);
    expect(points[0]!.remaining).toBe(1);
  });
});

describe("sprintProgress", () => {
  it("считает выполненное и остаток дней", () => {
    const p = sprintProgress(
      [task({ status: "DONE" }), task()],
      КОНЕЦ,
      new Date("2026-08-19T12:00:00")
    );
    expect(p).toMatchObject({ total: 2, done: 1, ratio: 0.5, daysLeft: 2, overdue: false });
  });

  it("спринт кончился с незакрытой работой — просрочен", () => {
    const p = sprintProgress([task()], КОНЕЦ, new Date("2026-08-25T12:00:00"));
    expect(p.overdue).toBe(true);
    expect(p.daysLeft).toBeLessThan(0);
  });

  it("всё закрыто — просрочки нет, даже если дата прошла", () => {
    const p = sprintProgress([task({ status: "DONE" })], КОНЕЦ, new Date("2026-08-25T12:00:00"));
    expect(p.overdue).toBe(false);
    expect(p.ratio).toBe(1);
  });

  it("пустой спринт не делит на ноль", () => {
    expect(sprintProgress([], КОНЕЦ, new Date("2026-08-19T12:00:00")).ratio).toBe(0);
  });
});
