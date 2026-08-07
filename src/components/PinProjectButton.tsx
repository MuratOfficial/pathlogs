"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleProjectPinAction } from "@/lib/actions/projects";

/**
 * Звёздочка «закрепить проект»: закреплённые проекты попадают в боковое меню
 * для быстрой навигации. Закрепление персональное — у каждого своё.
 */
export function PinProjectButton({
  projectId,
  pinned: initial,
}: {
  projectId: string;
  pinned: boolean;
}) {
  const router = useRouter();
  const [pinned, setPinned] = useState(initial);
  const [pending, startTransition] = useTransition();

  // Сервер прислал свежие props — синхронизируемся с ними (напр. открепили
  // проект на другой вкладке или на другой странице)
  const [prev, setPrev] = useState(initial);
  if (initial !== prev && !pending) {
    setPrev(initial);
    setPinned(initial);
  }

  return (
    <button
      type="button"
      disabled={pending}
      data-tip={pinned ? "Открепить из бокового меню" : "Закрепить в боковом меню"}
      aria-label={pinned ? "Открепить проект" : "Закрепить проект"}
      aria-pressed={pinned}
      onClick={() => {
        setPinned(!pinned);
        startTransition(async () => {
          await toggleProjectPinAction(projectId);
          // Список в сайдбаре живёт в layout — обновляем всё дерево
          router.refresh();
        });
      }}
      className={`rounded-lg p-1.5 transition hover:bg-surface-2 disabled:opacity-50 ${
        pinned ? "text-amber-400" : "text-muted hover:text-foreground"
      }`}
    >
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill={pinned ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.48 3.5a.56.56 0 011.04 0l2.13 4.31 4.76.69c.46.07.64.63.31.95l-3.44 3.35.81 4.73c.08.46-.4.81-.81.59L12 15.85l-4.26 2.24c-.41.22-.89-.13-.81-.59l.81-4.73-3.44-3.35a.56.56 0 01.31-.95l4.76-.69 2.11-4.28z"
        />
      </svg>
    </button>
  );
}
