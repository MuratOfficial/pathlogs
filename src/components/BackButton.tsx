"use client";

import { useRouter } from "next/navigation";

/**
 * Маленькая кнопка «назад» — возврат на предыдущую страницу истории.
 * Отличается от ссылки-стрелки на список проектов: возвращает именно туда,
 * откуда пришли (доска, поиск, уведомления).
 */
export function BackButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      data-tip="Назад"
      aria-label="Вернуться на предыдущую страницу"
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-edge text-muted transition hover:bg-surface-2 hover:text-foreground ${className}`}
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
      </svg>
    </button>
  );
}
