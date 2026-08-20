"use client";

import { useActionState } from "react";
import { submitIntakeAction } from "@/lib/actions/intake";

/**
 * Форма заявки для человека снаружи: без входа в систему и без единого
 * упоминания внутренностей проекта. После отправки поля не показываем заново —
 * повторная отправка той же заявки обычно случайна.
 */
export function IntakeForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(submitIntakeAction, undefined);

  if (state?.ok) {
    return (
      <div className="animate-pop-in rounded-xl border border-green-500/40 bg-green-500/10 p-5 text-center">
        <p className="text-lg font-semibold">Заявка отправлена</p>
        <p className="mt-1 text-sm text-muted">
          Мы получили её и свяжемся с вами по оставленному контакту.
        </p>
      </div>
    );
  }

  const field = "w-full rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm outline-none transition focus:border-accent";

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />

      {/* Ловушка для ботов: видимый человек это поле не заполнит */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />

      <label className="block">
        <span className="mb-1 block text-xs text-muted">Как к вам обращаться</span>
        <input name="name" required maxLength={80} className={field} placeholder="Имя" />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs text-muted">Контакт для ответа</span>
        <input
          name="contact"
          required
          maxLength={120}
          className={field}
          placeholder="Почта или телефон"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs text-muted">Суть заявки</span>
        <input
          name="title"
          required
          maxLength={160}
          className={field}
          placeholder="Коротко — одной строкой"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs text-muted">Подробности (необязательно)</span>
        <textarea
          name="details"
          rows={5}
          maxLength={4000}
          className={`${field} resize-y`}
          placeholder="Что произошло, чего вы ждёте, сроки"
        />
      </label>

      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="btn-gradient mt-1 rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
      >
        {pending ? "Отправляем…" : "Отправить заявку"}
      </button>
    </form>
  );
}
