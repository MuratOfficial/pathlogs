const FEATURES = [
  { title: "Ветвление задач", desc: "Подзадачи-ветки и граф реализации как в git" },
  { title: "Канбан и Гант", desc: "Drag & drop, WIP-лимиты и сроки на временной шкале" },
  { title: "Патч-логи и аналитика", desc: "История реализации, трудозатраты и стоимость" },
];

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

        <p className="animate-fade-up delay-6 text-xs text-muted">
          © {new Date().getFullYear()} PathLogs · задачи, ветки, патч-логи
        </p>
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
        </div>
      </main>
    </div>
  );
}
