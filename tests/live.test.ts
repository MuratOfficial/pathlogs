import { describe, it, expect } from "vitest";
import { projectVersion } from "@/lib/live";

const base = {
  taskCount: 5,
  lastTaskUpdate: new Date("2026-08-20T10:00:00Z"),
  columnCount: 4,
  lastColumnUpdate: new Date("2026-08-19T10:00:00Z"),
};

describe("projectVersion", () => {
  it("одно и то же состояние даёт один и тот же отпечаток", () => {
    expect(projectVersion(base)).toBe(projectVersion({ ...base }));
  });

  it("изменение задачи меняет отпечаток", () => {
    const later = { ...base, lastTaskUpdate: new Date("2026-08-20T10:00:05Z") };
    expect(projectVersion(later)).not.toBe(projectVersion(base));
  });

  it("удаление задачи заметно, хотя время последнего изменения не сдвинулось", () => {
    expect(projectVersion({ ...base, taskCount: 4 })).not.toBe(projectVersion(base));
  });

  it("колонки учитываются наравне с задачами", () => {
    expect(projectVersion({ ...base, columnCount: 5 })).not.toBe(projectVersion(base));
    expect(
      projectVersion({ ...base, lastColumnUpdate: new Date("2026-08-20T11:00:00Z") })
    ).not.toBe(projectVersion(base));
  });

  it("пустой проект не ломает отпечаток", () => {
    expect(
      projectVersion({ taskCount: 0, lastTaskUpdate: null, columnCount: 0, lastColumnUpdate: null })
    ).toBe("0.0.0.0");
  });

  it("строка и Date с одним моментом времени дают одинаковый отпечаток", () => {
    expect(projectVersion({ ...base, lastTaskUpdate: "2026-08-20T10:00:00Z" })).toBe(
      projectVersion(base)
    );
  });
});
