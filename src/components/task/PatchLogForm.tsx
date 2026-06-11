"use client";

import { useActionState, useEffect, useRef } from "react";
import { addPatchLogAction } from "@/lib/actions/tasks";

export function PatchLogForm({ taskId }: { taskId: string }) {
  const [state, formAction, pending] = useActionState(addPatchLogAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && !state.error) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-xl border border-edge bg-surface-2/40 p-4"
    >
      <input type="hidden" name="taskId" value={taskId} />
      <input
        name="title"
        required
        minLength={2}
        placeholder="Заголовок записи (например: «Реализован API эндпоинт оплаты»)"
        className="mb-2.5 w-full rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <textarea
        name="content"
        required
        rows={3}
        placeholder="Полное описание реализации: что сделано, как, какие решения приняты…"
        className="mb-3 w-full resize-y rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
      />
      {state?.error && (
        <p className="mb-3 text-sm text-red-400">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold transition hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Сохраняем…" : "Добавить запись"}
      </button>
    </form>
  );
}
