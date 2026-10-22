/**
 * Вложения: ограничения загрузки и разметка вставок в описание.
 *
 * Файл намеренно чистый — ни prisma, ни fs: его импортируют и серверные
 * роуты, и клиентские компоненты (загрузчик, редактор описания).
 */

/** Предел размера одного файла. Больше — и загрузка упирается в память роута. */
export const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024;

/** Сколько живёт черновик, не ставший вложением задачи. */
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

/** Картинку показываем превью, остальное — строкой с именем файла. */
export function isImageMime(mime: string): boolean {
  // svg не считаем картинкой: его отдаёт наш же origin, и внутри может быть
  // скрипт — в <img> он не выполнится, но и превью от него не нужно.
  return mime.startsWith("image/") && mime !== "image/svg+xml";
}

/** Размер файла по-человечески: КБ до мегабайта, дальше МБ. */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 ** 2) {
    const mb = bytes / 1024 ** 2;
    return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} МБ`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}

/**
 * Вставка файла в описание.
 *
 * Своя разметка, а не markdown-картинка: разбор markdown в
 * @toimetdev/pathlogs-core картинки не поддерживает намеренно — чужой адрес
 * в тексте не должен превращаться в запрос из чужого браузера. Здесь же в
 * тексте стоит только id, а сам файл берётся из вложений этой задачи: что
 * не приложено к задаче, то и не покажется.
 */
export function fileEmbed(id: string): string {
  return `[[file:${id}]]`;
}

/** Строка целиком — и только она — является вставкой файла. */
const FILE_EMBED_LINE = /^[ \t]*\[\[file:([A-Za-z0-9_-]{1,64})\]\][ \t]*$/;

export type DescriptionSegment =
  | { kind: "text"; text: string }
  | { kind: "file"; id: string };

/**
 * Делит описание на куски текста и вставки файлов.
 *
 * Вставка опознаётся только как отдельная строка: `[[file:…]]` посреди
 * абзаца остаётся текстом. Иначе вставка рвала бы абзац надвое, а разбор
 * markdown получал бы на вход половинки списков и блоков кода.
 */
export function splitDescription(text: string): DescriptionSegment[] {
  const segments: DescriptionSegment[] = [];
  let buffer: string[] = [];

  const flush = () => {
    const joined = buffer.join("\n");
    if (joined.trim()) segments.push({ kind: "text", text: joined });
    buffer = [];
  };

  for (const line of text.split(/\r?\n/)) {
    const m = FILE_EMBED_LINE.exec(line);
    if (m) {
      flush();
      segments.push({ kind: "file", id: m[1] });
    } else {
      buffer.push(line);
    }
  }
  flush();
  return segments;
}

/** id всех файлов, вставленных в описание (в порядке появления, без повторов). */
export function embeddedFileIds(text: string): string[] {
  const ids = splitDescription(text)
    .filter((s): s is { kind: "file"; id: string } => s.kind === "file")
    .map((s) => s.id);
  return [...new Set(ids)];
}

/**
 * Описание без вставок — для мест, где разметку показать нечем: письма,
 * ics-события, ссылка в Google Calendar.
 */
export function stripFileEmbeds(text: string): string {
  return splitDescription(text)
    .filter((s) => s.kind === "text")
    .map((s) => (s as { text: string }).text.trim())
    .join("\n\n");
}

/**
 * Вставляет разметку файла в текст на место курсора.
 *
 * Вставка занимает отдельную строку (так её опознаёт splitDescription),
 * поэтому вокруг при необходимости добавляются переводы строки, а подряд
 * идущие пустые строки не копятся. Возвращает текст и новое место курсора.
 */
export function insertEmbedAtCursor(
  text: string,
  embed: string,
  cursor: number
): { text: string; cursor: number } {
  const at = Math.max(0, Math.min(cursor, text.length));
  const before = text.slice(0, at);
  const after = text.slice(at);
  const lead = before === "" || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  const tail = after === "" ? "\n" : after.startsWith("\n") ? "" : "\n\n";
  const inserted = `${lead}${embed}${tail}`;
  return {
    text: `${before}${inserted}${after}`,
    cursor: at + inserted.length,
  };
}

/**
 * Приводит переводы строк к \n.
 *
 * Описание, отправленное обычной формой, приходит с \r\n (так требует HTML),
 * а textarea отдаёт позицию курсора по тексту уже без \r. Разъехавшись на
 * эти невидимые символы, вставка файла попадала не туда, куда указывал
 * курсор, — поэтому \r убираем и при сохранении, и при открытии правки.
 */
export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}
