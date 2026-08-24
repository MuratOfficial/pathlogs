/**
 * Модель фильтра — без React и без DOM.
 *
 * Фильтр описывается набором полей, а не жёсткой структурой: одно и то же
 * состояние обслуживает и список, и доску, и сохранённые пресеты, а новое
 * условие добавляется одной записью в описании, а не правкой пяти файлов.
 *
 * Хранится фильтр строкой запроса (`status=TODO&assignee=…`) — в этом же виде
 * он лежит в сохранённых пресетах и в адресной строке, поэтому ссылка на
 * отфильтрованный список открывается ровно тем же, чем была.
 */

/** «Любое значение». Не пустая строка: у селекта всегда должен быть выбран пункт. */
export const ANY = "ALL";

/** Значение одного условия. */
export type FilterValue = string;

/** Состояние фильтра: поле → значение. */
export type FilterState = Record<string, FilterValue>;

/** Как поле фильтрует элемент. */
export type FilterMatcher<T> = (item: T, value: string) => boolean;

export interface FilterField<T> {
  /** Ключ поля: он же ключ в строке запроса. */
  key: string;
  label: string;
  /**
   * Тип контрола. `text` — свободный ввод, `select` — список вариантов.
   */
  kind: "text" | "select";
  /** Варианты для select. Пункт «любое» добавляется сам. */
  options?: { value: string; label: string; color?: string }[];
  /** Подпись пункта «любое». */
  anyLabel?: string;
  /** Подходит ли элемент под заданное значение поля. */
  matches: FilterMatcher<T>;
  placeholder?: string;
}

/** Пустое состояние: у каждого поля значение «любое». */
export function emptyFilter<T>(fields: FilterField<T>[]): FilterState {
  const state: FilterState = {};
  for (const field of fields) {
    state[field.key] = field.kind === "text" ? "" : ANY;
  }
  return state;
}

/** Задано ли поле — то есть участвует ли оно в отборе. */
export function isFieldSet<T>(field: FilterField<T>, value: FilterValue | undefined): boolean {
  if (value === undefined) return false;
  return field.kind === "text" ? value.trim() !== "" : value !== ANY;
}

/** Задан ли хоть один критерий: от этого зависит, есть ли что сбрасывать. */
export function isFilterActive<T>(fields: FilterField<T>[], state: FilterState): boolean {
  return fields.some((f) => isFieldSet(f, state[f.key]));
}

/** Собирает строку запроса. В неё попадают только заданные условия. */
export function serializeFilter<T>(fields: FilterField<T>[], state: FilterState): string {
  const params = new URLSearchParams();
  for (const field of fields) {
    const value = state[field.key];
    if (isFieldSet(field, value)) params.set(field.key, value!.trim());
  }
  return params.toString();
}

/**
 * Разбирает строку запроса. Неизвестные ключи игнорируются: сохранённый
 * пресет должен пережить исчезновение поля, а не сломать экран.
 */
export function parseFilter<T>(fields: FilterField<T>[], query: string): FilterState {
  const params = new URLSearchParams(query);
  const state = emptyFilter(fields);
  for (const field of fields) {
    const value = params.get(field.key);
    if (value !== null && value !== "") state[field.key] = value;
  }
  return state;
}

/**
 * Подходит ли элемент под фильтр.
 *
 * Незаданные поля пропускаются, а не считаются несовпадением: пустой фильтр
 * должен показывать всё, а не ничего.
 */
export function matchesFilter<T>(
  fields: FilterField<T>[],
  state: FilterState,
  item: T
): boolean {
  for (const field of fields) {
    const value = state[field.key];
    if (!isFieldSet(field, value)) continue;
    if (!field.matches(item, value!.trim())) return false;
  }
  return true;
}

/** Сколько условий задано — числом на свёрнутой кнопке фильтра. */
export function activeFieldCount<T>(fields: FilterField<T>[], state: FilterState): number {
  return fields.filter((f) => isFieldSet(f, state[f.key])).length;
}

/**
 * Готовый матчер текстового поиска по нескольким свойствам элемента.
 *
 * Ищет подстроку без учёта регистра сразу по всем указанным полям: «12»
 * находит элемент с номером 12, а «оплат» — «Страница оплаты». Числа
 * приводятся к строке, поэтому номер ищется наравне с названием.
 */
export function textMatcher<T>(pick: (item: T) => (string | number | null | undefined)[]) {
  return (item: T, value: string): boolean => {
    const needle = value.toLowerCase();
    return pick(item).some((part) =>
      part == null ? false : String(part).toLowerCase().includes(needle)
    );
  };
}

/** Матчер по точному совпадению одного свойства. */
export function equalsMatcher<T>(pick: (item: T) => string | null | undefined) {
  return (item: T, value: string): boolean => pick(item) === value;
}

/** Матчер «значение есть среди связанных сущностей»: исполнители, метки. */
export function includesMatcher<T>(pick: (item: T) => { id: string }[]) {
  return (item: T, value: string): boolean => pick(item).some((x) => x.id === value);
}
