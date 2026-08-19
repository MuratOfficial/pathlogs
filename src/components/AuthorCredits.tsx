/**
 * Подпись автора для страниц, которые видят снаружи: экраны входа и публичный
 * роадмап. Внутри приложения её нет намеренно — там она была бы шумом.
 */

/** Другие проекты автора: строка не громче копирайта рядом. */
const AUTHOR_LINKS = [
  {
    href: "https://english-school-liart.vercel.app/",
    label: "LinguaLeap",
    title: "LinguaLeap — онлайн-школа английского языка",
  },
  {
    href: "https://free-ai-school-beta.vercel.app/",
    label: "FreeAISchool",
    title: "FreeAISchool — онлайн-школа профессии ИИ-инженер",
  },
];

/** Чип со ссылкой на GitHub — акцент подвала, но не крикливый. */
export function DevelopedBy() {
  return (
    <a
      href="https://github.com/MuratOfficial"
      target="_blank"
      rel="noopener noreferrer"
      title="GitHub автора — MuratOfficial"
      className="group inline-flex items-center gap-2 rounded-full border border-edge bg-surface/60 py-1.5 pl-3 pr-3.5 text-xs text-muted shadow-sm backdrop-blur transition hover:border-accent/50 hover:bg-surface hover:text-foreground hover:shadow-accent/10"
    >
      <span className="opacity-90">Разработано</span>
      <svg
        className="h-4 w-4 shrink-0 transition group-hover:text-accent-hover"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden
      >
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 012-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8 8 0 0016 8c0-4.42-3.58-8-8-8z" />
      </svg>
      <span className="font-semibold tracking-tight">MuratOfficial</span>
    </a>
  );
}

export function AuthorLinks({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-muted/75 ${className}`}>
      <span className="opacity-80">Другие проекты автора: </span>
      {AUTHOR_LINKS.map((l, i) => (
        <span key={l.href}>
          {i > 0 && (
            <span aria-hidden className="px-1.5 opacity-50">
              ·
            </span>
          )}
          <a
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            title={l.title}
            className="underline decoration-dotted underline-offset-2 transition hover:text-foreground"
          >
            {l.label}
          </a>
        </span>
      ))}
    </p>
  );
}
