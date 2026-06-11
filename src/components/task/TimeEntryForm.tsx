"use client";

import { useActionState, useEffect, useRef } from "react";
import { addTimeEntryAction } from "@/lib/actions/tasks";

export function TimeEntryForm({ taskId }: { taskId: string }) {
  const [state, formAction, pending] = useActionState(addTimeEntryAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && !state.error) formRef.current?.reset();
  }, [state]);

  const inputCls =
    "rounded-lg border border-edge bg-surface-2 px-2.5 py-1.5 text-sm outline-none focus:border-accent";

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      <input type="hidden" name="taskId" value={taskId} />
      <div className="flex gap-2">
        <input
          name="hours"
          type="number"
          step="0.25"
          min="0.25"
          required
          placeholder="Часы"
          className={`${inputCls} w-20`}
        />
        <input
          name="date"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          className={`${inputCls} flex-1`}
        />
      </div>
      <div className="flex gap-2">
        <input
          name="note"
          placeholder="Комментарий (необязательно)"
          className={`${inputCls} min-w-0 flex-1`}
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold transition hover:bg-accent-hover disabled:opacity-50"
        >
          +
        </button>
      </div>
      {state?.error && <p className="text-xs text-red-400">{state.error}</p>}
    </form>
  );
}
