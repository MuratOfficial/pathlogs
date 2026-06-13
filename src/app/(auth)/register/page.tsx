"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction } from "@/lib/actions/auth";

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(registerAction, undefined);

  return (
    <div className="animate-pop-in rounded-3xl border border-edge bg-surface/80 p-8 shadow-2xl backdrop-blur-xl">
      <form action={formAction}>
        <h2 className="animate-fade-up text-xl font-bold tracking-tight">Регистрация</h2>
        <p className="animate-fade-up delay-1 mb-6 mt-1 text-sm text-muted">
          Первый зарегистрированный пользователь получает права администратора
        </p>

        <label className="animate-fade-up delay-2 mb-4 block">
          <span className="mb-1.5 block text-sm text-muted">Имя</span>
          <input
            name="name"
            required
            minLength={2}
            placeholder="Иван Петров"
            className="auth-input"
          />
        </label>

        <label className="animate-fade-up delay-3 mb-4 block">
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

        <label className="animate-fade-up delay-4 mb-5 block">
          <span className="mb-1.5 block text-sm text-muted">Пароль</span>
          <input
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="минимум 6 символов"
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
          className="btn-gradient animate-fade-up delay-5 w-full rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          {pending ? "Создаём аккаунт…" : "Зарегистрироваться"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Уже есть аккаунт?{" "}
        <Link href="/login" className="font-medium text-accent-hover transition hover:text-accent-2 hover:underline">
          Войти
        </Link>
      </p>
    </div>
  );
}
