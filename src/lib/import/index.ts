import { parseExcel } from "./excel";
import { parseMsProject } from "./msproject";
import type { ParsedImport } from "./map";

export type { ParsedImport, ParsedTask } from "./map";

/** Имя файла без расширения — кандидат в имя проекта. */
function baseName(filename: string): string | null {
  const stem = filename.replace(/\.[^.]+$/, "").trim();
  return stem || null;
}

/**
 * Определяет формат по расширению/содержимому и парсит файл в задачи.
 * Поддержка: .xlsx/.xls (Excel) и .xml (MS Project XML).
 */
export async function parseImportFile(
  filename: string,
  buffer: Buffer
): Promise<ParsedImport> {
  const fallback = baseName(filename);
  const ext = filename.toLowerCase().match(/\.([^.]+)$/)?.[1] ?? "";

  if (ext === "xlsx" || ext === "xls" || ext === "xlsm") {
    return parseExcel(buffer, fallback);
  }
  if (ext === "xml" || ext === "mpx") {
    return parseMsProject(buffer.toString("utf8"), fallback);
  }

  // Без расширения — пробуем по содержимому
  const head = buffer.subarray(0, 200).toString("utf8");
  if (head.includes("<Project")) {
    return parseMsProject(buffer.toString("utf8"), fallback);
  }
  // .xlsx — это zip (PK\x03\x04)
  if (buffer[0] === 0x50 && buffer[1] === 0x4b) {
    return parseExcel(buffer, fallback);
  }

  throw new Error(
    "Неподдерживаемый формат. Загрузите .xlsx (Excel) или .xml (MS Project)."
  );
}
