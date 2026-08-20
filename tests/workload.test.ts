import { describe, it, expect } from "vitest";
import { buildWorkload, unassignedCount, type WorkloadTask } from "@/lib/workload";

const МАША = { id: "m", name: "Маша" };
const ПЕТЯ = { id: "p", name: "Петя" };
const NOW = new Date("2026-08-20T12:00:00Z");

const task = (over: Partial<WorkloadTask> = {}): WorkloadTask => ({
  status: "TODO",
  estimateHours: null,
  spentHours: 0,
  dueDate: null,
  assignees: [МАША],
  ...over,
});

const члены = [
  { id: "m", name: "Маша" },
  { id: "p", name: "Петя" },
];

describe("buildWorkload", () => {
  it("в сводке есть каждый участник, даже без задач", () => {
    const rows = buildWorkload([], члены, NOW);
    expect(rows.map((r) => r.name).sort()).toEqual(["Маша", "Петя"]);
    expect(rows.every((r) => r.openTasks === 0)).toBe(true);
  });

  it("нагрузка — это незакрытые задачи; закрытые в неё не идут", () => {
    const rows = buildWorkload(
      [task(), task({ status: "IN_PROGRESS" }), task({ status: "DONE" })],
      члены,
      NOW
    );
    const маша = rows.find((r) => r.userId === "m")!;
    expect(маша.openTasks).toBe(2);
    expect(маша.inProgress).toBe(1);
  });

  it("часы задачи на двоих делятся поровну — сумма по команде не раздувается", () => {
    const rows = buildWorkload(
      [task({ estimateHours: 10, spentHours: 6, assignees: [МАША, ПЕТЯ] })],
      члены,
      NOW
    );
    expect(rows.find((r) => r.userId === "m")!.openEstimate).toBe(5);
    expect(rows.find((r) => r.userId === "p")!.spentHours).toBe(3);
    const всего = rows.reduce((s, r) => s + r.spentHours, 0);
    expect(всего).toBe(6);
  });

  it("просроченной считается только незакрытая задача", () => {
    const вчера = "2026-08-19T12:00:00Z";
    const rows = buildWorkload(
      [task({ dueDate: вчера }), task({ dueDate: вчера, status: "DONE" })],
      члены,
      NOW
    );
    expect(rows.find((r) => r.userId === "m")!.overdue).toBe(1);
  });

  it("срок в будущем просрочкой не считается", () => {
    const rows = buildWorkload([task({ dueDate: "2026-09-01T12:00:00Z" })], члены, NOW);
    expect(rows.find((r) => r.userId === "m")!.overdue).toBe(0);
  });


  it("самые загруженные — сверху", () => {
    const rows = buildWorkload(
      [task({ assignees: [ПЕТЯ] }), task({ assignees: [ПЕТЯ] }), task()],
      члены,
      NOW
    );
    expect(rows[0]!.userId).toBe("p");
  });

  it("исполнитель, которого нет в списке участников, всё равно попадает в сводку", () => {
    const rows = buildWorkload([task({ assignees: [{ id: "x", name: "Бывший" }] })], члены, NOW);
    expect(rows.some((r) => r.name === "Бывший")).toBe(true);
  });
});

describe("unassignedCount", () => {
  it("считает только открытые задачи без исполнителя", () => {
    const tasks = [
      task({ assignees: [] }),
      task({ assignees: [], status: "CLOSED" }),
      task(),
    ];
    expect(unassignedCount(tasks)).toBe(1);
  });
});
