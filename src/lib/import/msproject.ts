import type { TaskStatus } from "@prisma/client";
import { priorityFromNumber, type ParsedImport, type ParsedTask } from "./map";

const MAX_TASKS = 5000;

/**
 * Извлекает значение первого вхождения тега из фрагмента XML.
 * MS Project XML — плоский по задаче, поэтому простого извлечения достаточно.
 */
function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decodeXml(m[1]!.trim()) : null;
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, "&");
}

function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Преобразует ISO 8601-длительность (PT8H30M0S) в часы. */
function durationToHours(raw: string | null): number | null {
  if (!raw) return null;
  const m = raw.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/i);
  if (!m) return null;
  const h = Number(m[1] ?? 0);
  const min = Number(m[2] ?? 0);
  const sec = Number(m[3] ?? 0);
  const total = h + min / 60 + sec / 3600;
  return total > 0 ? Math.round(total * 100) / 100 : null;
}

function statusFromPercent(pct: number, started: boolean): TaskStatus {
  if (pct >= 100) return "DONE";
  if (pct > 0 || started) return "IN_PROGRESS";
  return "TODO";
}

/**
 * Парсит MS Project XML (формат «Project 2003+ XML», расширение .xml).
 * Иерархия восстанавливается по OutlineLevel: родитель — ближайшая
 * предшествующая задача с уровнем на единицу меньше.
 */
export function parseMsProject(
  text: string,
  fallbackName: string | null
): ParsedImport {
  if (!/<Project[\s>]/i.test(text) || !/<Tasks>/i.test(text)) {
    throw new Error("Файл не похож на MS Project XML (экспортируйте проект как XML)");
  }

  const projectName =
    tag(text, "Title") || tag(text, "Name") || fallbackName;

  const blocks = text.match(/<Task>[\s\S]*?<\/Task>/gi) ?? [];
  const tasks: ParsedTask[] = [];
  // Стек открытых родителей: [{ level, ref }]
  const stack: { level: number; ref: string }[] = [];
  let order = 0;

  for (const block of blocks) {
    if (tasks.length >= MAX_TASKS) break;
    const name = tag(block, "Name");
    const uid = tag(block, "UID") ?? tag(block, "ID");
    // Нулевая «корневая» задача проекта (UID 0 без имени) — пропускаем
    if (!name || !name.trim() || uid === "0") continue;

    const level = Number(tag(block, "OutlineLevel") ?? "1") || 1;
    const ref = `uid-${uid ?? order}`;

    // Родитель — последняя задача с меньшим уровнем
    while (stack.length && stack[stack.length - 1]!.level >= level) stack.pop();
    const parentRef = stack.length ? stack[stack.length - 1]!.ref : null;

    const pct = Number(tag(block, "PercentComplete") ?? "0") || 0;
    const start = parseDate(tag(block, "Start"));
    const priorityNum = Number(tag(block, "Priority") ?? "500");

    tasks.push({
      ref,
      parentRef,
      title: name.trim().slice(0, 500),
      description: tag(block, "Notes")?.trim() || null,
      status: statusFromPercent(pct, Boolean(start && start <= new Date())),
      type: null,
      priority: priorityFromNumber(Number.isFinite(priorityNum) ? priorityNum : 500),
      columnName: null, // группируем по статусу
      assigneeEmails: [],
      estimateHours: durationToHours(tag(block, "Work")),
      startDate: start,
      dueDate: parseDate(tag(block, "Finish")),
      order: order++,
    });

    stack.push({ level, ref });
  }

  if (tasks.length === 0) {
    throw new Error("В MS Project XML не найдено задач");
  }

  return { format: "msproject", projectName, tasks };
}
