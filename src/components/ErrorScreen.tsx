import Link from "next/link";
import { AuthorLinks, DevelopedBy } from "@/components/AuthorCredits";
import { BrandMark } from "@/components/BrandMark";

/**
 * Общий экран для 404 и ошибок выполнения.
 *
 * Собран из того же, что и вход: аврора на фоне, карточка на surface, подпись
 * автора внизу — чтобы страница ошибки не выглядела выпавшей из приложения.
 * Серверный компонент без состояния: его одинаково используют и not-found
 * (сервер), и error/global-error (клиент).
 */
export interface ErrorScreenProps {
  /** Крупная цифра-код: 404, 500. Пустой — когда кода нет. */
  code?: string;
  title: string;
  description: string;
  /** Идентификатор ошибки для сопоставления с серверными логами. */
  digest?: string;
  /** Кнопки: «Попробовать снова» и т. п. Ссылка на главную есть всегда. */
  children?: React.ReactNode;
  /** Оттенок ауроры и кода: у 404 спокойный, у сбоя — тревожный. */
  tone?: "accent" | "danger";
}

export function ErrorScreen({
  code,
  title,
  description,
  digest,
  children,
  tone = "accent",
}: ErrorScreenProps) {
  const glow = tone === "danger" ? "var(--danger)" : "var(--accent)";

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-hidden">
      <div className="auth-aurora" aria-hidden>
        <span
          className="aurora-blob"
          style={{ width: 520, height: 520, top: -140, left: -90, background: glow }}
        />
        <span
          className="aurora-blob"
          style={{
            width: 420,
            height: 420,
            bottom: -120,
            right: -70,
            background: "var(--accent-3)",
            animationDelay: "-7s",
          }}
        />
        <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px]" />
      </div>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg text-center">
          <Link
            href="/"
            className="animate-fade-up mb-8 inline-flex items-center gap-3"
            aria-label="На главную"
          >
            <BrandMark className="h-11 w-11 animate-float rounded-2xl shadow-lg shadow-accent/30" />
            <span className="text-lg font-bold tracking-tight">PathLogs</span>
          </Link>

          {code && (
            <p
              className="animate-fade-up delay-1 select-none text-7xl font-extrabold leading-none tracking-tight sm:text-8xl"
              // Код — самый крупный элемент, но он декоративный: смысл несёт
              // заголовок под ним, поэтому от скринридера код прячем.
              aria-hidden
            >
              <span className="gradient-text">{code}</span>
            </p>
          )}

          <div className="animate-fade-up delay-2 mt-6 rounded-2xl border border-edge bg-surface/80 p-6 backdrop-blur sm:p-8">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            <p className="mt-3 text-sm text-muted">{description}</p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
              {children}
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-edge px-5 py-2.5 text-sm font-semibold transition hover:border-accent/50 hover:bg-surface-2"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75"
                  />
                </svg>
                На главную
              </Link>
            </div>

            {digest && (
              <p className="mt-6 border-t border-edge pt-4 text-xs text-muted">
                Код ошибки для поддержки:{" "}
                <code className="font-mono text-muted/90">{digest}</code>
              </p>
            )}
          </div>
        </div>
      </main>

      <footer className="relative z-10 flex flex-col items-center gap-3 px-4 pb-10">
        <DevelopedBy />
        <AuthorLinks className="text-center" />
      </footer>
    </div>
  );
}

/** Кнопка-действие рядом с «На главную»: тот же размер, акцентная заливка. */
export function ErrorAction({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover"
    >
      {children}
    </button>
  );
}
