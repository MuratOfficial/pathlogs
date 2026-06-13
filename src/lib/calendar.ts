/**
 * Экспорт задач в календари: ссылка-шаблон Google Calendar и файл .ics
 * (универсальный — Google / Outlook / Apple). API-ключи не нужны:
 * Google Calendar принимает предзаполненное событие обычным URL.
 */

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function nextDay(d: Date): Date {
  const n = new Date(d);
  n.setUTCDate(n.getUTCDate() + 1);
  return n;
}

export interface TaskEvent {
  title: string;
  details: string;
  /** Начало (если нет — используется дата срока). */
  start: Date | null;
  /** Срок задачи. */
  due: Date | null;
  /** Абсолютная ссылка на задачу. */
  url?: string;
}

/** Диапазон дат события целиком на день: [start, dueExclusive). */
function eventRange(e: TaskEvent): { from: Date; to: Date } | null {
  const from = e.start ?? e.due;
  if (!from) return null;
  const lastDay = e.due && e.due >= from ? e.due : from;
  return { from, to: nextDay(lastDay) };
}

/** Ссылка «добавить в Google Calendar» (событие на весь день). */
export function googleCalendarUrl(e: TaskEvent): string | null {
  const range = eventRange(e);
  if (!range) return null;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${ymd(range.from)}/${ymd(range.to)}`,
    details: e.url ? `${e.details}\n\n${e.url}`.trim() : e.details,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

function icsEscape(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function vevent(e: TaskEvent, uid: string, stamp: string): string[] | null {
  const range = eventRange(e);
  if (!range) return null;
  return [
    "BEGIN:VEVENT",
    `UID:${uid}@pathlogs`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${ymd(range.from)}`,
    `DTEND;VALUE=DATE:${ymd(range.to)}`,
    `SUMMARY:${icsEscape(e.title)}`,
    `DESCRIPTION:${icsEscape(e.url ? `${e.details}\n\n${e.url}`.trim() : e.details)}`,
    ...(e.url ? [`URL:${e.url}`] : []),
    "END:VEVENT",
  ];
}

function wrap(events: string[][]): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PathLogs//RU",
    ...events.flat(),
    "END:VCALENDAR",
  ].join("\r\n");
}

/** Файл iCalendar с одним событием на весь день. */
export function buildIcs(e: TaskEvent, uid: string): string | null {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const ev = vevent(e, uid, stamp);
  return ev ? wrap([ev]) : null;
}

/** Файл iCalendar с несколькими событиями (задачи проекта с датами). */
export function buildIcsCalendar(items: { event: TaskEvent; uid: string }[]): string | null {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const events = items
    .map((it) => vevent(it.event, it.uid, stamp))
    .filter((x): x is string[] => x !== null);
  return events.length ? wrap(events) : null;
}
