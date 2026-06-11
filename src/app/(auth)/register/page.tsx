"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction } from "@/lib/actions/auth";

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(registerAction, undefined);

  return (
    <form
      action={formAction}
      className="rounded-2xl border border-edge bg-surface p-6 shadow-xl"
    >
      <h2 className="mb-1 text-lg font-semibold">Регистрация</h2>
      <p className="mb-5 text-xs text-muted">
        Первый зарегистрированный пользователь получает права администратора
      </p>

      <label className="mb-4 block">
        <span className="mb-1.5 block text-sm text-muted">Имя</span>
        <input
          name="name"
          required
          minLength={2}
          placeholder="Иван Петров"
          className="w-full rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm outline-none transition focus:border-accent"
        />
      </label>

      <label className="mb-4 block">
        <span className="mb-1.5 block text-sm text-muted">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@company.com"
          className="w-full rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm outline-none transition focus:border-accent"
        />
      </label>

      <label className="mb-5 block">
        <span className="mb-1.5 block text-sm text-muted">Пароль</span>
        <input
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          placeholder="минимум 6 символов"
          className="w-full rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm outline-none transition focus:border-accent"
        />
      </label>

      {state?.error && (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold transition hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Создаём аккаунт…" : "Зарегистрироваться"}
      </button>

      <p className="mt-4 text-center text-sm text-muted">
        Уже есть аккаунт?{" "}
        <Link href="/login" className="text-accent-hover hover:underline">
          Войти
        </Link>
      </p>
    </form>
  );
}
