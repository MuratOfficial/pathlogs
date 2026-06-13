"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { loginAction, googleLoginAction } from "@/lib/actions/auth";

export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const [state, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <div className="animate-pop-in rounded-3xl border border-edge bg-surface/80 p-8 shadow-2xl backdrop-blur-xl">
      <form action={formAction}>
        <h2 className="animate-fade-up text-xl font-bold tracking-tight">Вход в систему</h2>
        <p className="animate-fade-up delay-1 mb-6 mt-1 text-sm text-muted">
          Рады видеть снова 👋
        </p>
        <input type="hidden" name="callbackUrl" value={callbackUrl} />

        <label className="animate-fade-up delay-2 mb-4 block">
          <span className="mb-1.5 block text-sm text-muted">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@company.com"
            className="auth-input"
          />
        </label>

        <label className="animate-fade-up delay-3 mb-5 block">
          <span className="mb-1.5 block text-sm text-muted">Пароль</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="auth-input"
          />
        </label>

        {state?.error && (
          <p
            key={state.error}
            className="animate-shake mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400"
          >
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="btn-gradient animate-fade-up delay-4 w-full rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          {pending ? "Входим…" : "Войти"}
        </button>
      </form>

      {googleEnabled && (
        <>
          <div className="my-4 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-edge" />
            или
            <span className="h-px flex-1 bg-edge" />
          </div>
          <form action={googleLoginAction}>
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-edge bg-surface-2 py-2.5 text-sm font-semibold transition hover:bg-surface active:scale-[0.98]"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z" />
                <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 015.5 12c0-.73.13-1.43.34-2.1V7.06H2.18a11 11 0 000 9.88l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0012 1 11 11 0 002.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              Войти через Google
            </button>
          </form>
        </>
      )}

      <p className="mt-6 text-center text-sm text-muted">
        Нет аккаунта?{" "}
        <Link href="/register" className="font-medium text-accent-hover transition hover:text-accent-2 hover:underline">
          Зарегистрироваться
        </Link>
      </p>
    </div>
  );
}
