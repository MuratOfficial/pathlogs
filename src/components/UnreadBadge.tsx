"use client";

import { useEffect, useState } from "react";

/**
 * Живой счётчик непрочитанных уведомлений. Стартует со значения, отрендеренного
 * на сервере, затем периодически опрашивает /api/notifications/unread-count
 * (и при возврате фокуса на вкладку), чтобы число обновлялось без перезагрузки.
 */
export function UnreadBadge({ initial }: { initial: number }) {
  const [count, setCount] = useState(initial);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      // Не опрашиваем, пока вкладка в фоне — экономим запросы
      if (document.hidden) return;
      try {
        const res = await fetch("/api/notifications/unread-count", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { count?: number };
        if (!cancelled && typeof data.count === "number") setCount(data.count);
      } catch {
        // сеть недоступна — просто пробуем в следующий раз
      }
    }

    const id = setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  if (count <= 0) return null;

  return (
    <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}
