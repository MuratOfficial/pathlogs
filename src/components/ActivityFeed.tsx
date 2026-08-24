"use client";

// Лента активности на ActivityTimeline из @toimetdev/pathlogs-core: события
// группируются по дням, серии однотипных сворачиваются (раскрываются кликом).
// Домен задаёт иконку по типу события и содержимое строки (кто, что, ссылка
// на задачу). Группировка и относительное время — внутри пакета, под тестами.
import Link from "next/link";
import { ActivityTimeline } from "@toimetdev/pathlogs-core";
import type { Activity, ActivityKind } from "@/lib/activity";

const META: Record<ActivityKind, { color: string; path: string }> = {
  task: {
    color: "#a855f7",
    path: "M12 4.5v15m7.5-7.5h-15",
  },
  comment: {
    color: "#60a5fa",
    path: "M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z",
  },
  patchlog: {
    color: "#22d3ee",
    path: "M6 6.878V6a2.25 2.25 0 012.25-2.25h7.5A2.25 2.25 0 0118 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 004.5 9v.878m13.5-3A2.25 2.25 0 0119.5 9v.878m0 0a2.246 2.246 0 00-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0121 12v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6c0-.98.626-1.813 1.5-2.122",
  },
  time: {
    color: "#4ade80",
    path: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z",
  },
};

export function ActivityFeed({
  items,
  projectKey,
}: {
  items: Activity[];
  projectKey: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-edge bg-surface/50 p-16 text-center">
        <p className="text-lg font-medium">Пока нет активности</p>
        <p className="mt-1 text-sm text-muted">
          Здесь появятся задачи, комментарии, патч-логи и записи времени
        </p>
      </div>
    );
  }

  return (
    // Та же обёртка, что у остальных вкладок проекта: своя прокрутка внутри
    // и общая ширина.
    <div className="h-full overflow-y-auto pb-4">
      <div className="mx-auto max-w-400">
        <ActivityTimeline
          events={items}
          locale="ru-RU"
          renderIcon={(a) => {
            const m = META[a.kind as ActivityKind];
            return (
              <svg
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke={m.color}
                strokeWidth={2}
                style={{ backgroundColor: m.color + "22", borderRadius: 9999 }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={m.path} />
              </svg>
            );
          }}
          renderBurst={(events) => `${events.length} событий: ${events[0]!.actor}`}
          renderEvent={(a) => (
            <span className="flex flex-col gap-0.5">
              <span className="flex flex-wrap items-baseline gap-x-1.5 text-sm">
                <span className="font-medium">{a.actor}</span>
                <span className="text-muted">{a.detail}</span>
              </span>
              <Link
                href={`/tasks/${a.taskId}`}
                className="flex items-baseline gap-1.5 text-xs text-muted transition hover:text-accent-hover"
              >
                <span className="font-mono font-semibold">
                  {projectKey}-{a.taskNumber}
                </span>
                <span className="truncate">{a.taskTitle}</span>
              </Link>
            </span>
          )}
        />
      </div>
    </div>
  );
}
