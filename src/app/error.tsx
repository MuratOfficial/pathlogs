"use client";

import { useEffect } from "react";
import { ErrorAction, ErrorScreen } from "@/components/ErrorScreen";

/**
 * Границы ошибок обязаны быть клиентскими компонентами.
 *
 * Ловит сбои внутри страниц: упавший запрос к БД, ошибку server action,
 * недоступное хранилище. Корневой layout сюда не попадает — на него есть
 * global-error.tsx.
 *
 * В продакшене текст ошибки с сервера не доезжает: Next подменяет его общим
 * сообщением и присылает только digest, чтобы не утекли подробности. Поэтому
 * показываем digest — по нему ошибку находят в логах.
 */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorScreen
      code="500"
      tone="danger"
      title="Что-то пошло не так"
      description="Страницу не удалось собрать. Часто это временно — попробуйте ещё раз, а если повторяется, вернитесь на главную."
      digest={error.digest}
    >
      <ErrorAction onClick={() => retry()}>
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
            d="M16.023 9.348h4.992V4.356m-4.993 4.992l3.181-3.183a8.25 8.25 0 00-13.803 3.7M4.031 9.865v4.992m0 0h4.992m-4.993 0l3.182 3.182a8.25 8.25 0 0013.803-3.7"
          />
        </svg>
        Попробовать снова
      </ErrorAction>
    </ErrorScreen>
  );
}
