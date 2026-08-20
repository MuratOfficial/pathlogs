"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type State = "connecting" | "live" | "offline";

/**
 * Живая доска: подписка на изменения проекта. Когда кто-то из команды двигает
 * карточки, сервер присылает событие, и страница подтягивает свежие данные
 * через router.refresh() — без перезагрузки и без потери прокрутки.
 *
 * Обновление откладывается, пока вкладка скрыта: обновлять невидимую доску
 * незачем, а вернувшись, пользователь всё равно увидит свежее состояние.
 */
export function LiveBoard({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>("connecting");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const pending = useRef(false);

  useEffect(() => {
    const source = new EventSource(`/api/projects/${projectId}/stream`);

    const refresh = () => {
      if (document.visibilityState === "hidden") {
        pending.current = true;
        return;
      }
      pending.current = false;
      setUpdatedAt(new Date());
      router.refresh();
    };

    source.addEventListener("sync", () => setState("live"));
    source.addEventListener("change", refresh);
    source.onopen = () => setState("live");
    // EventSource переподключается сам; наше дело — показать, что связь пропала
    source.onerror = () => setState("offline");

    const onVisible = () => {
      if (document.visibilityState === "visible" && pending.current) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      source.close();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [projectId, router]);

  const label =
    state === "live"
      ? updatedAt
        ? `обновлено в ${updatedAt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`
        : "живые обновления"
      : state === "connecting"
        ? "подключаемся…"
        : "нет связи — обновления приостановлены";

  return (
    <span
      data-tip={
        state === "live"
          ? "Изменения коллег появляются на доске сами"
          : "Обновления придут, как только связь восстановится"
      }
      className="flex items-center gap-1.5 text-xs text-muted"
    >
      <span
        aria-hidden
        className={`h-2 w-2 shrink-0 rounded-full ${
          state === "live"
            ? "bg-green-500"
            : state === "connecting"
              ? "bg-amber-500"
              : "bg-red-500"
        }`}
      />
      {label}
    </span>
  );
}
