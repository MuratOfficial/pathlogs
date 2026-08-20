/** Как часто сервер заглядывает в БД в поисках изменений (мс). */
export const LIVE_POLL_MS = 4000;

/**
 * Сколько живёт одно SSE-соединение (мс).
 *
 * Меньше лимита времени выполнения у serverless-хостинга: поток закрывается
 * сам, а EventSource в браузере переподключается — так «живая» доска не
 * упирается в обрыв по таймауту платформы.
 */
export const LIVE_STREAM_MS = 45_000;

/** Части состояния проекта, по которым видно, что на доске что-то поменялось. */
export interface ProjectVersionParts {
  taskCount: number;
  lastTaskUpdate: Date | string | null;
  columnCount: number;
  lastColumnUpdate: Date | string | null;
}

/**
 * Отпечаток состояния проекта: меняется, когда меняется доска.
 *
 * Считаем по количеству и времени последнего изменения, а не по содержимому:
 * это один дешёвый агрегат вместо выгрузки всех задач. Количество нужно
 * отдельно от времени — удаление задачи время последнего изменения не двигает.
 */
export function projectVersion(parts: ProjectVersionParts): string {
  const ms = (v: Date | string | null) => (v ? new Date(v).getTime() : 0);
  return [parts.taskCount, ms(parts.lastTaskUpdate), parts.columnCount, ms(parts.lastColumnUpdate)].join(
    "."
  );
}
