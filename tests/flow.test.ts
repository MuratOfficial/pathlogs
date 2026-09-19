import { describe, it, expect } from "vitest";
import {
  cycleTimeMs,
  flowSummary,
  formatDuration,
  leadTimeMs,
  percentile,
  timeInStatus,
  weekStart,
  weeklyFlow,
  type FlowTask,
} from "@/lib/flow";

const HOUR = 3600_000;
const DAY = 24 * HOUR;

function at(iso: string) {
  return new Date(iso);
}

function task(partial: Partial<FlowTask> & { events: FlowTask["events"] }): FlowTask {
  return {
    id: "t1",
    key: "PAY-1",
    title: "Задача",
    createdAt: at("2026-09-01T09:00:00Z"),
    ...partial,
  };
}

describe("cycleTimeMs", () => {
  it("меряет от начала работы до готовности", () => {
    const t = task({
      events: [
        { toStatus: "TODO", at: at("2026-09-01T09:00:00Z") },
        { toStatus: "IN_PROGRESS", at: at("2026-09-03T09:00:00Z") },
        { toStatus: "DONE", at: at("2026-09-05T09:00:00Z") },
      ],
    });
    expect(cycleTimeMs(t)).toBe(2 * DAY);
  });

  it("берёт первое завершение, а не последнее", () => {
    // Задачу переоткрыли и закрыли снова: второй круг — другая работа,
    // и склеивать его с первым значило бы выдать простой за разработку.
    const t = task({
      events: [
        { toStatus: "IN_PROGRESS", at: at("2026-09-01T09:00:00Z") },
        { toStatus: "DONE", at: at("2026-09-02T09:00:00Z") },
        { toStatus: "IN_PROGRESS", at: at("2026-09-20T09:00:00Z") },
        { toStatus: "DONE", at: at("2026-09-21T09:00:00Z") },
      ],
    });
    expect(cycleTimeMs(t)).toBe(1 * DAY);
  });

  it("считает проверку началом работы", () => {
    const t = task({
      events: [
        { toStatus: "REVIEW", at: at("2026-09-01T09:00:00Z") },
        { toStatus: "CLOSED", at: at("2026-09-01T15:00:00Z") },
      ],
    });
    expect(cycleTimeMs(t)).toBe(6 * HOUR);
  });

  it("не меряет незавершённую задачу", () => {
    const t = task({ events: [{ toStatus: "IN_PROGRESS", at: at("2026-09-01T09:00:00Z") }] });
    expect(cycleTimeMs(t)).toBeNull();
  });

  it("не меряет задачу, закрытую без отметки о работе", () => {
    const t = task({ events: [{ toStatus: "DONE", at: at("2026-09-01T09:00:00Z") }] });
    expect(cycleTimeMs(t)).toBeNull();
  });

  it("не выдаёт отрицательное время при обратном порядке кликов", () => {
    const t = task({
      events: [
        { toStatus: "DONE", at: at("2026-09-05T09:00:00Z") },
        { toStatus: "IN_PROGRESS", at: at("2026-09-06T09:00:00Z") },
      ],
    });
    expect(cycleTimeMs(t)).toBeNull();
  });
});

describe("leadTimeMs", () => {
  it("считает от создания, включая ожидание в очереди", () => {
    const t = task({
      createdAt: at("2026-09-01T09:00:00Z"),
      events: [
        { toStatus: "IN_PROGRESS", at: at("2026-09-08T09:00:00Z") },
        { toStatus: "DONE", at: at("2026-09-09T09:00:00Z") },
      ],
    });
    expect(leadTimeMs(t)).toBe(8 * DAY);
    // И это заметно больше времени цикла — ровно тот разрыв, ради которого
    // обе метрики и нужны рядом.
    expect(cycleTimeMs(t)).toBe(1 * DAY);
  });
});

describe("percentile", () => {
  it("возвращает медиану нечётного ряда", () => {
    expect(percentile([3, 1, 2], 0.5)).toBe(2);
  });

  it("интерполирует между соседями", () => {
    expect(percentile([0, 10], 0.5)).toBe(5);
  });

  it("на краях отдаёт минимум и максимум", () => {
    expect(percentile([4, 9, 1], 0)).toBe(1);
    expect(percentile([4, 9, 1], 1)).toBe(9);
  });

  it("на пустом ряду — null, а не ноль", () => {
    expect(percentile([], 0.5)).toBeNull();
  });
});

describe("timeInStatus", () => {
  it("складывает отрезки между переходами", () => {
    const t = task({
      events: [
        { toStatus: "TODO", at: at("2026-09-01T00:00:00Z") },
        { toStatus: "IN_PROGRESS", at: at("2026-09-02T00:00:00Z") },
        { toStatus: "TODO", at: at("2026-09-03T00:00:00Z") },
        { toStatus: "IN_PROGRESS", at: at("2026-09-04T00:00:00Z") },
      ],
    });
    const spent = timeInStatus(t, at("2026-09-05T00:00:00Z"));
    expect(spent.TODO).toBe(2 * DAY);
    expect(spent.IN_PROGRESS).toBe(2 * DAY);
  });

  it("тянет последний отрезок до сейчас", () => {
    // Иначе у зависшей задачи «В работе» показывало бы ноль — ровно наоборот
    // тому, что происходит.
    const t = task({ events: [{ toStatus: "IN_PROGRESS", at: at("2026-09-01T00:00:00Z") }] });
    expect(timeInStatus(t, at("2026-09-11T00:00:00Z")).IN_PROGRESS).toBe(10 * DAY);
  });
});

describe("weekStart", () => {
  it("отматывает к понедельнику", () => {
    // 19 сентября 2026 — суббота.
    expect(weekStart(new Date(2026, 8, 19)).getDay()).toBe(1);
    expect(weekStart(new Date(2026, 8, 19)).getDate()).toBe(14);
  });

  it("понедельник оставляет на месте", () => {
    expect(weekStart(new Date(2026, 8, 14)).getDate()).toBe(14);
  });
});

describe("weeklyFlow", () => {
  const now = new Date(2026, 8, 19, 12, 0, 0);

  it("раскладывает завершения по неделям закрытия", () => {
    const monday = weekStart(now);
    const lastWeek = new Date(monday.getTime() - 7 * DAY + 2 * HOUR);
    const thisWeek = new Date(monday.getTime() + 2 * HOUR);
    const tasks: FlowTask[] = [
      task({
        id: "a",
        createdAt: new Date(lastWeek.getTime() - DAY),
        events: [
          { toStatus: "IN_PROGRESS", at: new Date(lastWeek.getTime() - DAY) },
          { toStatus: "DONE", at: lastWeek },
        ],
      }),
      task({
        id: "b",
        createdAt: new Date(thisWeek.getTime() - 2 * DAY),
        events: [
          { toStatus: "IN_PROGRESS", at: new Date(thisWeek.getTime() - 2 * DAY) },
          { toStatus: "DONE", at: thisWeek },
        ],
      }),
    ];
    const weeks = weeklyFlow(tasks, 4, now);
    expect(weeks).toHaveLength(4);
    expect(weeks[2]!.done).toBe(1);
    expect(weeks[3]!.done).toBe(1);
    expect(weeks[3]!.medianCycleHours).toBeCloseTo(48, 5);
  });

  it("считает завершённой задачу без отметки о работе, но не меряет её цикл", () => {
    const tasks: FlowTask[] = [
      task({ events: [{ toStatus: "DONE", at: new Date(now.getTime() - HOUR) }] }),
    ];
    const weeks = weeklyFlow(tasks, 2, now);
    expect(weeks[1]!.done).toBe(1);
    expect(weeks[1]!.medianCycleHours).toBeNull();
  });

  it("не учитывает то, что вышло за окно", () => {
    const old = new Date(now.getTime() - 60 * DAY);
    const tasks: FlowTask[] = [task({ events: [{ toStatus: "DONE", at: old }] })];
    expect(weeklyFlow(tasks, 4, now).every((w) => w.done === 0)).toBe(true);
  });
});

describe("flowSummary", () => {
  const now = new Date(2026, 8, 19, 12, 0, 0);

  it("сводит медиану, перцентиль и пропускную способность", () => {
    const monday = weekStart(now);
    const make = (id: string, cycleDays: number): FlowTask =>
      task({
        id,
        createdAt: new Date(monday.getTime() - (cycleDays + 1) * DAY),
        events: [
          { toStatus: "IN_PROGRESS", at: new Date(monday.getTime() - cycleDays * DAY) },
          { toStatus: "DONE", at: monday },
        ],
      });
    const summary = flowSummary([make("a", 1), make("b", 2), make("c", 3)], 3, now);
    expect(summary.measured).toBe(3);
    expect(summary.medianCycleHours).toBeCloseTo(48, 5);
    expect(summary.throughputPerWeek).toBeCloseTo(1, 5);
  });

  it("в «где стоят» берёт только незавершённые задачи", () => {
    // Закрытая задача просидела в TODO десять дней, но это уже история;
    // если её учесть, текущий затык будет выглядеть вдвое хуже, чем есть.
    const done = task({
      id: "done",
      events: [
        { toStatus: "TODO", at: new Date(now.getTime() - 20 * DAY) },
        { toStatus: "IN_PROGRESS", at: new Date(now.getTime() - 10 * DAY) },
        { toStatus: "DONE", at: new Date(now.getTime() - 9 * DAY) },
      ],
    });
    const stuck = task({
      id: "stuck",
      events: [{ toStatus: "TODO", at: new Date(now.getTime() - 2 * DAY) }],
    });
    const summary = flowSummary([done, stuck], 4, now);
    expect(summary.waitingHours.TODO).toBeCloseTo(48, 5);
    expect(summary.waitingHours.IN_PROGRESS).toBeUndefined();
  });

  it("на проекте без истории ничего не выдумывает", () => {
    const summary = flowSummary([], 4, now);
    expect(summary.measured).toBe(0);
    expect(summary.medianCycleHours).toBeNull();
    expect(summary.p85CycleHours).toBeNull();
    expect(summary.throughputPerWeek).toBe(0);
  });
});

describe("formatDuration", () => {
  it("часы до суток, дальше дни", () => {
    expect(formatDuration(6)).toBe("6 ч");
    expect(formatDuration(23)).toBe("23 ч");
    expect(formatDuration(36)).toBe("1,5 дн.");
  });

  it("совсем короткое не округляет до нуля", () => {
    expect(formatDuration(0.4)).toBe("<1 ч");
  });

  it("отсутствие данных — прочерк, а не ноль", () => {
    expect(formatDuration(null)).toBe("—");
  });
});
