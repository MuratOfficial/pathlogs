"use client";

import { useTransition } from "react";
import type { TaskStatus } from "@prisma/client";
import { updateTaskStatusAction } from "@/lib/actions/tasks";

/**
 * Отметить задачу выполненной прямо со страницы задачи — без выбора статуса
 * в «Параметрах». Повторный клик возвращает задачу в работу.
 * Как и на доске, карточка при этом остаётся в своей колонке.
 */
export function TaskDoneButton({
  taskId,
  status,
}: {
  taskId: string;
  status: TaskStatus;
}) {
  const [pending, startTransition] = useTransition();
  const done = status === "DONE" || status === "CLOSED";

  return (
    <button
      type="button"
      disabled={pending}
      data-tip={done ? "Вернуть в «К выполнению»" : "Отметить задачу выполненной"}
      onClick={() =>
        startTransition(() => updateTaskStatusAction(taskId, done ? "TODO" : "DONE"))
      }
      className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold transition disabled:opacity-50 ${
        done
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
          : "border-edge text-muted hover:border-emerald-500/50 hover:text-emerald-400"
      }`}
    >
      <span
        className={`flex h-4 w-4 items-center justify-center rounded-full border ${
          done ? "border-emerald-500 bg-emerald-500 text-white" : "border-current"
        }`}
      >
        <svg className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 10.5l3.5 3.5L15 6.5" />
        </svg>
      </span>
      {done ? "Выполнена" : "Выполнить"}
    </button>
  );
}
