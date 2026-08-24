"use client";

// Живая доска на useEventStream + LiveIndicator из фреймворка. Хук подписывается
// на SSE-поток проекта, откладывает обновление, пока вкладка скрыта, и догоняет
// при возврате; индикатор показывает состояние связи точкой и подписью.
import { useRouter } from "next/navigation";
import { useEventStream } from "@toimetdev/pathlogs-hooks";
import { LiveIndicator } from "@toimetdev/pathlogs-core";

export function LiveBoard({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { status, updatedAt } = useEventStream(`/api/projects/${projectId}/stream`, {
    events: ["change"],
    onEvent: () => router.refresh(),
  });

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
