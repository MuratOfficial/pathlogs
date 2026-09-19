/**
 * Марка PathLogs — тот же знак, что во вкладке браузера и в иконках PWA:
 * ствол с узлами и ответвление, то есть ветвление задач.
 *
 * Рисунок повторяет src/app/icon.svg. Градиент задан не внутри SVG, а фоном
 * через токены: в тёмной теме это ровно цвета фавиконки, в светлой — их более
 * глубокие варианты, как у остальных акцентов приложения. Заодно у знака нет
 * своего <defs> с id, поэтому его можно ставить на страницу сколько угодно раз
 * без конфликта идентификаторов.
 *
 * Знак декоративный: рядом всегда стоит слово «PathLogs», поэтому от
 * скринридера он скрыт.
 */
export function BrandMark({
  className = "h-8 w-8 rounded-lg",
}: {
  /** Размер, скругление и всё остальное для квадрата: h-8 w-8 rounded-lg … */
  className?: string;
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center bg-gradient-to-br from-accent via-accent-2 to-accent-pink text-white ${className}`}
      aria-hidden
    >
      <svg viewBox="0 0 64 64" className="h-full w-full">
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth={4.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 18 V46" />
          <path d="M22 28 H34 a8 8 0 0 1 8 8" />
        </g>
        <g fill="currentColor">
          <circle cx="22" cy="18" r="6" />
          <circle cx="22" cy="46" r="6" />
          <circle cx="42" cy="42" r="6" />
        </g>
      </svg>
    </span>
  );
}
