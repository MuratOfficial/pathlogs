"use client";

// Живая доска на usePolling из фреймворка: раз в LIVE_POLL_MS спрашиваем у
// сервера отпечаток проекта и, если он изменился, перерисовываем страницу.
// Хук сам не опрашивает скрытую вкладку и догоняет при возврате фокуса.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePolling, type StreamStatus } from "@toimetdev/pathlogs-hooks";
import { LiveIndicator } from "@toimetdev/pathlogs-core";
import { LIVE_POLL_MS } from "@/lib/live";

/** Ответ опроса: версия либо признак того, что до сервера не достучались. */
type Probe = { version: string | null; reachable: boolean };

export function LiveBoard({ projectId }: { projectId: string }) {
  const router = useRouter();
  // Версия, при которой отрисована текущая страница. Первый успешный ответ
  // её только запоминает: страница и так свежая, обновлять нечего.
  const seen = useRef<string | null>(null);
  // Отдельным состоянием, а не чтением seen в рендере: ref для рендера не
  // предназначен и его изменение перерисовку не вызывает.
  const [synced, setSynced] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const { data } = usePolling<Probe>(
    async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/version`, {
          cache: "no-store",
        });
        if (!res.ok) return { version: null, reachable: false };
        const body = (await res.json()) as { version?: string };
        return { version: body.version ?? null, reachable: true };
      } catch {
        return { version: null, reachable: false };
      }
    },
    {
      initial: { version: null, reachable: true },
      interval: LIVE_POLL_MS,
      // Первый опрос сразу: иначе индикатор висел бы «подключаемся…» до конца
      // первого интервала, а базовую версию мы бы узнали с опозданием.
      immediate: true,
    }
  );

  useEffect(() => {
    if (!data.reachable || !data.version) return;
    if (seen.current === data.version) return;
    const first = seen.current === null;
    seen.current = data.version;
    if (first) {
      setSynced(true);
      return;
    }
    setUpdatedAt(new Date());
    router.refresh();
  }, [data, router]);

  const status: StreamStatus = !data.reachable
    ? "offline"
    : synced
      ? "live"
      : "connecting";

  return (
    <LiveIndicator
      status={status}
      updatedAt={updatedAt}
      locale="ru-RU"
      labels={{
        live: "живые обновления",
        connecting: "подключаемся…",
        offline: "нет связи — обновления приостановлены",
        updated: "обновлено в {time}",
        tipLive: "Изменения коллег появляются на доске сами",
        tipOffline: "Обновления придут, как только связь восстановится",
      }}
    />
  );
}
