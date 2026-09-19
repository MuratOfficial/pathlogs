"use client";

import { useEffect } from "react";
import { themeScript } from "@toimetdev/pathlogs-tokens";
import { skinScript } from "@/lib/skin";
import { ErrorAction, ErrorScreen } from "@/components/ErrorScreen";
import "./globals.css";

/**
 * Последний рубеж: сюда попадают сбои самого корневого layout, когда обычный
 * error.tsx отрисовать уже не на чем.
 *
 * Этот файл заменяет собой корневой layout, поэтому html и body объявляет сам,
 * сам подключает globals.css и сам ставит тему со скином — до них иначе не
 * дотянуться, и страница светила бы белым у тех, кто сидит в тёмной. Шрифты
 * проекта не тянем намеренно: на аварийной странице системный шрифт надёжнее
 * и быстрее.
 *
 * Метаданные здесь не поддерживаются (клиентский компонент) — заголовок
 * ставится тегом title прямо в разметке.
 */
export default function GlobalError({
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
    <html lang="ru" suppressHydrationWarning className="h-full antialiased">
      <head>
        <title>Сбой приложения — PathLogs</title>
        <script dangerouslySetInnerHTML={{ __html: themeScript() }} />
        <script dangerouslySetInnerHTML={{ __html: skinScript() }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ErrorScreen
          tone="danger"
          title="Приложение не запустилось"
          description="Сбой произошёл до того, как страница начала собираться. Попробуйте ещё раз — если не помогает, обновите вкладку чуть позже."
          digest={error.digest}
        >
          <ErrorAction onClick={() => retry()}>Попробовать снова</ErrorAction>
        </ErrorScreen>
      </body>
    </html>
  );
}
