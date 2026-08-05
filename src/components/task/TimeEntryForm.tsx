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
    "rounded-lg border border-edge bg-surface-2 px-2.5 py-1.5 text-sm outline-none transition focus:border-accent";

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      <input type="hidden" name="taskId" value={taskId} />
      <div className="flex gap-2">
        <label className="block w-24 shrink-0">
          <span className="mb-1 block text-[11px] text-muted">Часы</span>
          <input
            name="hours"
            type="number"
            step="0.25"
            min="0.25"
            required
            placeholder="1.5"
            className={`${inputCls} w-full`}
          />
        </label>
        <label className="block min-w-0 flex-1">
          <span className="mb-1 block text-[11px] text-muted">Дата</span>
          <input
            name="date"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className={`${inputCls} w-full`}
          />
        </label>
      </div>
      {/* Комментарий — многострочное поле на всю ширину: длинный текст
          переносится и виден целиком, а не уезжает за границу поля. */}
      <label className="block">
        <span className="mb-1 block text-[11px] text-muted">Комментарий</span>
        <textarea
          name="note"
          rows={2}
          maxLength={500}
          placeholder="Что делали за это время (необязательно)"
          className={`${inputCls} w-full resize-y leading-relaxed`}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold transition hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Добавляем…" : "Добавить запись"}
      </button>
      {state?.error && <p className="text-xs text-red-400">{state.error}</p>}
    </form>
  );
}
