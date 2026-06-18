import ExcelJS from "exceljs";
import { auth } from "@/auth";
import { NextResponse } from "next/server";

/** Отдаёт шаблон Excel для импорта задач (заголовки + примеры строк). */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "PathLogs";
  const ws = wb.addWorksheet("Задачи");

  ws.columns = [
    { header: "Название", key: "title", width: 40 },
    { header: "Описание", key: "description", width: 50 },
    { header: "Статус", key: "status", width: 16 },
    { header: "Тип", key: "type", width: 16 },
    { header: "Приоритет", key: "priority", width: 14 },
    { header: "Исполнитель", key: "assignee", width: 26 },
    { header: "Оценка (ч)", key: "estimate", width: 12 },
    { header: "Начало", key: "start", width: 14 },
    { header: "Срок", key: "due", width: 14 },
    { header: "Колонка", key: "column", width: 18 },
    { header: "Родитель", key: "parent", width: 30 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E293B" },
  };
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  ws.addRow({
    title: "Сверстать главную страницу",
    description: "Адаптивный лендинг по макету",
    status: "В работе",
    type: "Фича",
    priority: "Высокий",
    assignee: "dev@example.com",
    estimate: 8,
    start: "2026-06-20",
    due: "2026-06-30",
    column: "В работе",
    parent: "",
  });
  ws.addRow({
    title: "Кнопка регистрации не кликается на iOS",
    description: "Воспроизводится в Safari",
    status: "К выполнению",
    type: "Баг",
    priority: "Критический",
    assignee: "qa@example.com",
    estimate: 3,
    start: "",
    due: "2026-06-25",
    column: "К выполнению",
    parent: "",
  });

  // Лист с подсказками по допустимым значениям
  const help = wb.addWorksheet("Справка");
  help.columns = [
    { header: "Поле", key: "field", width: 18 },
    { header: "Допустимые значения", key: "values", width: 80 },
  ];
  help.getRow(1).font = { bold: true };
  [
    ["Название", "Обязательное. Текст задачи."],
    ["Статус", "К выполнению / В работе / На проверке / Готово / Закрыта (или TODO, IN_PROGRESS…)"],
    ["Тип", "Фича, Баг, Рефакторинг, Аналитика, Менеджмент, Дизайн, Документация, Исследование"],
    ["Приоритет", "Низкий, Средний, Высокий, Критический"],
    ["Исполнитель", "E-mail зарегистрированного пользователя. Несколько — через запятую."],
    ["Оценка (ч)", "Число часов, например 8 или 2.5"],
    ["Начало / Срок", "Дата, например 2026-06-30"],
    ["Колонка", "Если заполнено — создаётся своя колонка доски. Иначе колонки по статусу."],
    ["Родитель", "Точное название другой задачи из этого файла (для подзадач)."],
  ].forEach(([field, values]) => help.addRow({ field, values }));

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="pathlogs-import-template.xlsx"',
    },
  });
}
