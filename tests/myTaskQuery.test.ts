import { describe, it, expect } from "vitest";
import { matchesQuery, parseQuery } from "@toimetdev/pathlogs-core";
import { myTaskFields, myTaskText, type MyTask } from "@/lib/myTaskQuery";

/**
 * Проверяем не разбор запроса (он под тестами в самом фреймворке), а свою
 * часть: что ключи полей действительно достают нужные значения из задачи.
 * Ошибка здесь тихая и самая обидная — фильтр «работает», но ничего не находит.
 */

function task(partial: Partial<MyTask>): MyTask {
  return {
    id: "t1",
    number: 12,
    title: "Страница оплаты",
    status: "TODO",
    type: "FEATURE",
    priority: "MEDIUM",
    dueDate: null,
    estimateHours: null,
    spentHours: 0,
    checklistDone: 0,
    checklistTotal: 0,
    projectId: "p1",
    projectKey: "PAY",
    projectName: "Платёжный сервис",
    ...partial,
  };
}

const ALL: MyTask[] = [
  task({ id: "a", number: 12, title: "Страница оплаты", projectKey: "PAY" }),
  task({
    id: "b",
    number: 4,
    title: "Импорт из Excel",
    projectKey: "TECH",
    projectName: "Tech Projects",
    status: "IN_PROGRESS",
    type: "BUG",
    priority: "CRITICAL",
    estimateHours: 8,
    dueDate: "2026-09-25T00:00:00.000Z",
  }),
  task({
    id: "c",
    number: 7,
    title: "Рефакторинг платежей",
    projectKey: "PAY",
    type: "REFACTOR",
    priority: "CRITICAL",
    dueDate: "2026-12-01T00:00:00.000Z",
  }),
];

function search(query: string, tasks: MyTask[] = ALL, now = new Date("2026-09-19T12:00:00Z")) {
  const fields = myTaskFields(tasks);
  const parsed = parseQuery(query, fields);
  return tasks
    .filter((t) => matchesQuery(t, parsed, fields, { text: myTaskText, now }))
    .map((t) => t.id);
}

describe("поиск по моим задачам", () => {
  it("пустой запрос ничего не отсеивает", () => {
    expect(search("")).toEqual(["a", "b", "c"]);
  });

  it("фильтрует по проекту", () => {
    expect(search("project:PAY")).toEqual(["a", "c"]);
  });

  it("фильтрует по приоритету и статусу", () => {
    expect(search("priority:CRITICAL")).toEqual(["b", "c"]);
    expect(search("status:IN_PROGRESS")).toEqual(["b"]);
  });

  it("два условия складываются в И", () => {
    expect(search("project:PAY priority:CRITICAL")).toEqual(["c"]);
  });

  it("перечисление через запятую — это ИЛИ", () => {
    expect(search("type:BUG,REFACTOR")).toEqual(["b", "c"]);
  });

  it("сравнивает срок относительно сейчас", () => {
    // «Ближайшая неделя» — ровно то, ради чего в поле указан тип date.
    expect(search("due:<now+7d")).toEqual(["b"]);
  });

  it("сравнивает оценку числом", () => {
    expect(search("estimate:>4")).toEqual(["b"]);
  });

  it("свободное слово ищет и в названии, и в ключе задачи", () => {
    expect(search("оплат")).toEqual(["a"]);
    expect(search("PAY-7")).toEqual(["c"]);
  });

  it("опечатка в ключе не выдаёт полный список за отфильтрованный", () => {
    // Иначе «priorities:CRITICAL» тихо показал бы всё, как будто фильтр применён.
    expect(search("priorities:CRITICAL")).toEqual([]);
    expect(parseQuery("priorities:CRITICAL", myTaskFields(ALL)).unknownKeys).toEqual([
      "priorities",
    ]);
  });

  it("подсказки по проектам берутся только из имеющихся задач", () => {
    const projectField = myTaskFields(ALL).find((f) => f.key === "project")!;
    const options = projectField.options as { value: string }[];
    expect(options.map((o) => o.value).sort()).toEqual(["PAY", "TECH"]);
  });
});
