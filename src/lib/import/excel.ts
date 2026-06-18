import ExcelJS from "exceljs";
import {
  mapPriority,
  mapStatus,
  mapType,
  splitAssignees,
  type ParsedImport,
  type ParsedTask,
} from "./map";

const MAX_TASKS = 5000;

/** Группы синонимов заголовков столбцов (нижний регистр). */
const HEADERS: Record<string, string[]> = {
  title: ["title", "name", "задача", "название", "summary", "тема", "заголовок", "task", "subject"],
  description: ["description", "описание", "notes", "заметки", "детали", "desc", "комментарий"],
  status: ["status", "статус", "состояние", "state"],
  type: ["type", "тип", "категория", "kind"],
  priority: ["priority", "приоритет"],
  assignee: ["assignee", "assignees", "исполнитель", "исполнители", "ответственный", "owner", "resource", "resources", "назначен", "responsible"],
  estimate: ["estimate", "estimatehours", "оценка", "часы", "work", "трудозатраты", "estimate (h)", "estimate, h", "ч", "hours"],
  start: ["start", "начало", "startdate", "дата начала", "start date"],
  due: ["due", "duedate", "дедлайн", "срок", "finish", "окончание", "завершение", "due date", "deadline"],
  column: ["column", "колонка", "list", "список", "board", "доска", "этап", "stage", "lane"],
  parent: ["parent", "родитель", "родительская", "parent task", "надзадача"],
};

function normHeader(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Превращает значение ячейки exceljs в строку. */
function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const v = value as unknown as Record<string, unknown>;
    if (Array.isArray(v.richText)) {
      return (v.richText as { text?: string }[]).map((r) => r.text ?? "").join("");
    }
    if ("text" in v) return String(v.text ?? "");
    if ("result" in v) return v.result == null ? "" : String(v.result);
    if ("hyperlink" in v) return String(v.hyperlink ?? "");
    return "";
  }
  return String(value).trim();
}

function cellDate(value: ExcelJS.CellValue): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && "result" in (value as object)) {
    return cellDate((value as { result: ExcelJS.CellValue }).result);
  }
  const d = new Date(cellText(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function cellNumber(value: ExcelJS.CellValue): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return value;
  if (typeof value === "object" && "result" in (value as object)) {
    return cellNumber((value as { result: ExcelJS.CellValue }).result);
  }
  const n = parseFloat(cellText(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Парсит первый лист книги Excel в список задач. */
export async function parseExcel(
  buffer: Buffer,
  fallbackName: string | null
): Promise<ParsedImport> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws || ws.rowCount < 1) {
    throw new Error("В файле нет данных");
  }

  // Заголовки: первая непустая строка
  let headerRowIndex = 1;
  for (let r = 1; r <= Math.min(ws.rowCount, 10); r++) {
    const row = ws.getRow(r);
    const hasText = row.values && (row.values as ExcelJS.CellValue[]).some((c) => cellText(c).length > 0);
    if (hasText) {
      headerRowIndex = r;
      break;
    }
  }

  const headerRow = ws.getRow(headerRowIndex);
  // field -> column number
  const colOf: Partial<Record<keyof typeof HEADERS, number>> = {};
  headerRow.eachCell((cell, colNumber) => {
    const h = normHeader(cellText(cell.value));
    if (!h) return;
    // Отбрасываем единицы измерения в скобках/после запятой: «оценка (ч)» → «оценка»
    const stripped = h.replace(/\(.*?\)/g, "").replace(/[,*].*$/, "").trim();
    for (const field of Object.keys(HEADERS) as (keyof typeof HEADERS)[]) {
      if (colOf[field] != null) continue;
      if (HEADERS[field]!.includes(h) || HEADERS[field]!.includes(stripped)) {
        colOf[field] = colNumber;
        break;
      }
    }
  });

  // Если столбец заголовка задачи не распознан — берём первый столбец
  if (colOf.title == null) colOf.title = 1;

  const get = (row: ExcelJS.Row, field: keyof typeof HEADERS): ExcelJS.CellValue => {
    const c = colOf[field];
    return c == null ? null : row.getCell(c).value;
  };

  // Первый проход: собираем задачи. ref = "row-<n>", запоминаем сырое имя родителя.
  const tasks: ParsedTask[] = [];
  const titleToRef = new Map<string, string>();
  const parentRaw = new Map<string, string>(); // ref -> название родителя
  let order = 0;

  for (let r = headerRowIndex + 1; r <= ws.rowCount; r++) {
    if (tasks.length >= MAX_TASKS) break;
    const row = ws.getRow(r);
    const title = cellText(get(row, "title")).slice(0, 500).trim();
    if (!title) continue;

    const ref = `row-${r}`;
    tasks.push({
      ref,
      parentRef: null, // проставим во втором проходе
      title,
      description: cellText(get(row, "description")).trim() || null,
      status: mapStatus(cellText(get(row, "status"))),
      type: mapType(cellText(get(row, "type"))),
      priority: mapPriority(cellText(get(row, "priority"))),
      columnName: cellText(get(row, "column")).slice(0, 60).trim() || null,
      assigneeEmails: splitAssignees(cellText(get(row, "assignee"))),
      estimateHours: cellNumber(get(row, "estimate")),
      startDate: cellDate(get(row, "start")),
      dueDate: cellDate(get(row, "due")),
      order: order++,
    });
    const key = title.toLowerCase();
    if (!titleToRef.has(key)) titleToRef.set(key, ref);
    const p = cellText(get(row, "parent")).trim().toLowerCase();
    if (p) parentRaw.set(ref, p);
  }

  // Второй проход: связка parent по названию (родитель должен быть отдельной строкой)
  for (const t of tasks) {
    const p = parentRaw.get(t.ref);
    if (!p || p === t.title.toLowerCase()) continue;
    const pref = titleToRef.get(p);
    if (pref && pref !== t.ref) t.parentRef = pref;
  }

  if (tasks.length === 0) {
    throw new Error("Не найдено ни одной задачи (проверьте, что есть столбец с названием)");
  }

  return {
    format: "excel",
    projectName: ws.name && ws.name !== "Sheet1" ? ws.name : fallbackName,
    tasks,
  };
}
