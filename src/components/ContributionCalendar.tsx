"use client";

// Обёртка над HeatmapCalendar из @toimetdev/pathlogs-core: русские подписи и
// цвет из токена темы, чтобы карта не выбивалась из выбранного оформления.
// Клиентский компонент, потому что title — функция, а её через границу
// сервер/клиент не передать.
import { HeatmapCalendar } from "@toimetdev/pathlogs-core";

/** Подпись клетки: «14 февраля — 3 действия». */
function plural(n: number): string {
  const ten = n % 10;
  const hundred = n % 100;
  if (ten === 1 && hundred !== 11) return "действие";
  if (ten >= 2 && ten <= 4 && (hundred < 12 || hundred > 14)) return "действия";
  return "действий";
}

/** Столько же ступеней, сколько по умолчанию у HeatmapCalendar. */
const LEVELS = 4;

/**
 * Легенда своя, а не `legend` фреймворка.
 *
 * Там она рисуется HTML-элементами, но цвет ступени приходит из того же
 * помощника, что красит клетки внутри SVG, — то есть свойством fill. На span
 * оно не действует, и все квадратики выходят прозрачными: между «меньше» и
 * «больше» пустое место. Цвета ниже повторяют ту же лесенку, только через
 * background.
 */
function Legend() {
  return (
    <div className="mt-2 flex items-center gap-1.5 text-xs text-muted">
      <span>меньше</span>
      {Array.from({ length: LEVELS + 1 }, (_, level) => (
        <span
          key={level}
          aria-hidden
          className="inline-block h-3 w-3 rounded-[2px]"
          style={{
            background:
              level === 0
                ? "var(--surface-2)"
                : `color-mix(in srgb, var(--accent) ${Math.round((level / LEVELS) * 100)}%, transparent)`,
          }}
        />
      ))}
      <span>больше</span>
    </div>
  );
}

export function ContributionCalendar({
  values,
  from,
  to,
}: {
  values: Record<string, number>;
  /** ISO-строки: даты через границу сервер/клиент приезжают строками. */
  from: string;
  to: string;
}) {
  return (
    <>
      <HeatmapCalendar
        values={values}
        from={new Date(from)}
        to={new Date(to)}
        color="var(--accent)"
        locale="ru-RU"
        weekStart={1}
        levels={LEVELS}
        summary
        title={(cell) =>
          cell.value === 0
            ? `${cell.date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} — тихо`
            : `${cell.date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} — ${cell.value} ${plural(cell.value)}`
        }
      />
      <Legend />
    </>
  );
}
