import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { parseImportFile } from "@/lib/import";

async function makeXlsx(
  rows: Record<string, unknown>[],
  headers: string[]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  ws.addRow(headers);
  for (const r of rows) ws.addRow(headers.map((h) => r[h] ?? ""));
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

describe("Excel import", () => {
  it("парсит русские заголовки, статусы, типы и приоритеты", async () => {
    const buf = await makeXlsx(
      [
        { Название: "Задача A", Статус: "В работе", Тип: "Баг", Приоритет: "Высокий", "Оценка (ч)": 4 },
        { Название: "Задача B", Статус: "Готово", Тип: "Фича", Приоритет: "Низкий" },
      ],
      ["Название", "Статус", "Тип", "Приоритет", "Оценка (ч)"]
    );
    const res = await parseImportFile("проект.xlsx", buf);
    expect(res.format).toBe("excel");
    expect(res.tasks).toHaveLength(2);
    expect(res.tasks[0]).toMatchObject({
      title: "Задача A",
      status: "IN_PROGRESS",
      type: "BUG",
      priority: "HIGH",
      estimateHours: 4,
    });
    expect(res.tasks[1]).toMatchObject({ status: "DONE", type: "FEATURE", priority: "LOW" });
  });

  it("распознаёт английские заголовки и колонки/исполнителей/родителя", async () => {
    const buf = await makeXlsx(
      [
        { Title: "Parent", Status: "TODO", Column: "Backlog", Assignee: "a@x.com" },
        { Title: "Child", Status: "In Progress", Column: "Doing", Assignee: "a@x.com, b@x.com", Parent: "Parent" },
      ],
      ["Title", "Status", "Column", "Assignee", "Parent"]
    );
    const res = await parseImportFile("board.xlsx", buf);
    expect(res.tasks).toHaveLength(2);
    expect(res.tasks[0]!.columnName).toBe("Backlog");
    expect(res.tasks[1]!.columnName).toBe("Doing");
    expect(res.tasks[1]!.assigneeEmails).toEqual(["a@x.com", "b@x.com"]);
    // потомок ссылается на родителя по названию
    expect(res.tasks[1]!.parentRef).toBe(res.tasks[0]!.ref);
  });

  it("пропускает строки без названия", async () => {
    const buf = await makeXlsx(
      [{ Название: "Есть" }, { Название: "" }, { Название: "Тоже есть" }],
      ["Название", "Статус"]
    );
    const res = await parseImportFile("x.xlsx", buf);
    expect(res.tasks.map((t) => t.title)).toEqual(["Есть", "Тоже есть"]);
  });
});

describe("MS Project XML import", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Title>Запуск сайта</Title>
  <Tasks>
    <Task><UID>0</UID><Name></Name><OutlineLevel>0</OutlineLevel></Task>
    <Task>
      <UID>1</UID><Name>Дизайн</Name><OutlineLevel>1</OutlineLevel>
      <PercentComplete>100</PercentComplete><Priority>500</Priority>
      <Work>PT16H0M0S</Work><Notes>Макеты</Notes>
    </Task>
    <Task>
      <UID>2</UID><Name>Главная страница</Name><OutlineLevel>2</OutlineLevel>
      <PercentComplete>50</PercentComplete><Priority>900</Priority><Work>PT8H30M0S</Work>
    </Task>
    <Task>
      <UID>3</UID><Name>Тестирование</Name><OutlineLevel>1</OutlineLevel>
      <PercentComplete>0</PercentComplete><Priority>100</Priority>
    </Task>
  </Tasks>
</Project>`;

  it("парсит задачи, статусы из % и иерархию из OutlineLevel", async () => {
    const res = await parseImportFile("plan.xml", Buffer.from(xml, "utf8"));
    expect(res.format).toBe("msproject");
    expect(res.projectName).toBe("Запуск сайта");
    // корневая задача UID=0 без имени пропущена
    expect(res.tasks).toHaveLength(3);

    const [design, home, qa] = res.tasks;
    expect(design).toMatchObject({ title: "Дизайн", status: "DONE", estimateHours: 16, description: "Макеты" });
    expect(home).toMatchObject({ title: "Главная страница", status: "IN_PROGRESS", priority: "CRITICAL", estimateHours: 8.5 });
    expect(qa).toMatchObject({ title: "Тестирование", status: "TODO", priority: "LOW" });
    // «Главная страница» (уровень 2) — потомок «Дизайна» (уровень 1)
    expect(home!.parentRef).toBe(design!.ref);
    // «Тестирование» снова уровень 1 — без родителя
    expect(qa!.parentRef).toBeNull();
  });
});
