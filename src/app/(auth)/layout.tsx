const FEATURES = [
  { title: "Ветвление задач", desc: "Подзадачи-ветки и граф реализации как в git" },
  { title: "Канбан и Гант", desc: "Drag & drop, WIP-лимиты и сроки на временной шкале" },
  { title: "Патч-логи и аналитика", desc: "История реализации, трудозатраты и стоимость" },
];

/** Другие проекты автора: подпись под копирайтом, не громче его. */
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
  }
];

/** Подпись автора: чип со ссылкой на GitHub — акцент footer'а, но не крикливый. */
function DevelopedBy() {
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

function AuthorLinks({ className = "" }: { className?: string }) {
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

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen w-full overflow-hidden">
      {/* Анимированный фон */}
      <div className="auth-aurora" aria-hidden>
        <span
          className="aurora-blob"
          style={{ width: 520, height: 520, top: -120, left: -80, background: "var(--accent)" }}
        />
        <span
          className="aurora-blob"
          style={{ width: 460, height: 460, top: "30%", left: "35%", background: "var(--accent-2)", animationDelay: "-5s" }}
        />
        <span
          className="aurora-blob"
          style={{ width: 420, height: 420, bottom: -120, right: -60, background: "var(--accent-3)", animationDelay: "-9s" }}
        />
        <span
          className="aurora-blob"
          style={{ width: 360, height: 360, bottom: "20%", left: "10%", background: "var(--accent-pink)", opacity: 0.35, animationDelay: "-3s" }}
        />
        {/* затемнение для читаемости */}
        <div className="absolute inset-0 bg-background/55 backdrop-blur-[2px]" />
      </div>

      {/* Брендовая панель (десктоп) */}
      <aside className="relative z-10 hidden flex-col justify-between p-12 lg:flex lg:w-[46%]">
        <div className="flex items-center gap-3 animate-fade-up">
          <span className="flex h-11 w-11 animate-float items-center justify-center rounded-2xl bg-gradient-to-br from-accent via-accent-2 to-accent-pink text-xl font-bold text-white shadow-lg shadow-accent/30">
            P
          </span>
          <span className="text-lg font-bold tracking-tight">PathLogs</span>
        </div>

        <div className="max-w-md">
          <h1 className="animate-fade-up delay-1 text-5xl font-extrabold leading-[1.05] tracking-tight">
            Управляйте проектами <span className="gradient-text">по-новому</span>
          </h1>
          <p className="animate-fade-up delay-2 mt-5 text-base text-muted">
            Ветвление задач, канбан, патч-логи и аналитика — в одном инструменте для
            команды разработки, бизнеса и аналитики.
          </p>

          <ul className="mt-9 space-y-4">
            {FEATURES.map((f, i) => (
              <li
                key={f.title}
                className={`animate-fade-up delay-${i + 3} flex items-start gap-3`}
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent-hover ring-1 ring-accent/30">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </span>
                <span>
                  <span className="block text-sm font-semibold">{f.title}</span>
                  <span className="block text-sm text-muted">{f.desc}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="animate-fade-up delay-6">
          <DevelopedBy />
          <p className="mt-3 text-xs text-muted">
            © {new Date().getFullYear()} PathLogs · задачи, ветки, патч-логи
          </p>
          <AuthorLinks className="mt-1.5" />
        </div>
      </aside>

      {/* Колонка с формой */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Компактный логотип на мобильных */}
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <span className="mb-3 flex h-12 w-12 animate-float items-center justify-center rounded-2xl bg-gradient-to-br from-accent via-accent-2 to-accent-pink text-2xl font-bold text-white shadow-lg shadow-accent/30">
              P
            </span>
            <h1 className="text-2xl font-bold tracking-tight">PathLogs</h1>
            <p className="mt-1 text-sm text-muted">Задачи · ветки · патч-логи</p>
          </div>
          {children}
          {/* На узких экранах брендовая панель скрыта — показываем подпись здесь */}
          <div className="mt-8 flex flex-col items-center lg:hidden">
            <DevelopedBy />
            <AuthorLinks className="mt-3 text-center" />
          </div>
        </div>
      </main>
    </div>
  );
}
