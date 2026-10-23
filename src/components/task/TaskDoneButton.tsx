"use client";

import { useTransition } from "react";
import type { TaskStatus } from "@prisma/client";
import { updateTaskStatusAction } from "@/lib/actions/tasks";
import { Icon } from "@/components/ui/Icon";

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
          ? "border-success/40 bg-success/10 text-success-text hover:bg-success/20"
          : "border-edge text-muted hover:border-success/50 hover:text-success-text"
      }`}
    >
      <span
        className={`flex h-4 w-4 items-center justify-center rounded-full border ${
          done ? "border-success bg-success text-white" : "border-current"
        }`}
      >
        <Icon name="check" className="h-2.5 w-2.5" strokeWidth={3} />
      </span>
      {done ? "Выполнена" : "Выполнить"}
    </button>
  );
}
