"use client";

import { useState, useTransition } from "react";
import { addTaskLinkAction } from "@/lib/actions/tasks";

export function AddLinkForm({
  taskId,
  tasks,
}: {
  taskId: string;
  tasks: { id: string; number: number; title: string }[];
}) {
  const [target, setTarget] = useState("");
  const [type, setType] = useState<"BLOCKS" | "RELATES" | "DUPLICATES">("RELATES");
  const [pending, startTransition] = useTransition();

  const selectCls =
    "rounded-lg border border-edge bg-surface-2 px-2 py-1.5 text-xs outline-none focus:border-accent";

  return (
    <div className="flex gap-1.5">
      <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className={selectCls}>
        <option value="RELATES">связана</option>
        <option value="BLOCKS">блокирует</option>
        <option value="DUPLICATES">дублирует</option>
      </select>
      <select
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        className={`${selectCls} min-w-0 flex-1`}
      >
        <option value="">Выберите задачу…</option>
        {tasks.map((t) => (
          <option key={t.id} value={t.id}>
            #{t.number} {t.title}
          </option>
        ))}
      </select>
      <button
        disabled={!target || pending}
        onClick={() =>
          startTransition(async () => {
            await addTaskLinkAction(taskId, target, type);
            setTarget("");
          })
        }
        className="shrink-0 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold transition hover:bg-accent-hover disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}
