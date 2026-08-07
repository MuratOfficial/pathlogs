"use client";

import { useActionState, useState } from "react";
import { updateProjectAction } from "@/lib/actions/projects";
import { BOARD_PALETTE } from "@/lib/labels";

/**
 * Редактирование названия, ключа, описания и фонового цвета проекта
 * (владелец / менеджер / админ).
 */
export function EditProjectDialog({
  projectId,
  name,
  projectKey,
  description,
  color: initialColor,
}: {
  projectId: string;
  name: string;
  projectKey: string;
  description: string | null;
  color: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState<string | null>(initialColor);
  const [state, formAction, pending] = useActionState(
    async (prev: { error?: string; ok?: boolean } | undefined, formData: FormData) => {
      const res = await updateProjectAction(projectId, prev, formData);
      if (!res.error) setOpen(false);
      return res;
    },
    undefined
  );

  const inputCls =
    "w-full rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm outline-none transition focus:border-accent";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          // Каждое открытие начинается с сохранённого цвета: несохранённый
          // выбор из прошлого раза не «залипает»
          setColor(initialColor);
          setOpen(true);
        }}
        data-tip="Редактировать проект"
        aria-label="Редактировать проект"
        className="rounded-lg p-1.5 text-muted transition hover:bg-surface-2 hover:text-foreground"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
        </svg>
      </button>

      {open && (
        <div
          className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <form
            action={formAction}
            className="animate-pop-in w-full max-w-md rounded-2xl border border-edge bg-surface p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Настройки проекта</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-muted transition hover:text-foreground"
                aria-label="Закрыть"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <label className="mb-4 block">
              <span className="mb-1.5 block text-sm text-muted">Название *</span>
              <input
                name="name"
                required
                minLength={2}
                defaultValue={name}
                className={inputCls}
              />
            </label>

            <label className="mb-4 block">
              <span className="mb-1.5 block text-sm text-muted">
                Ключ * <span className="text-xs">· 2–6 латинских букв, префикс номеров задач</span>
              </span>
              <input
                name="key"
                required
                minLength={2}
                maxLength={6}
                pattern="[A-Za-z]+"
                defaultValue={projectKey}
                className={`${inputCls} font-mono uppercase`}
              />
            </label>

            <label className="mb-4 block">
              <span className="mb-1.5 block text-sm text-muted">Описание</span>
              <textarea
                name="description"
                rows={3}
                defaultValue={description ?? ""}
                placeholder="Цель проекта, контекст, ссылки…"
                className={`${inputCls} resize-y`}
              />
            </label>

            {/* Фон проекта: тонирует страницы проекта и его задач */}
            <div className="mb-5">
              <span className="mb-1.5 block text-sm text-muted">
                Цвет фона{" "}
                <span className="text-xs">· фон страниц проекта и его задач</span>
              </span>
              <input type="hidden" name="color" value={color ?? ""} />
              <div className="flex flex-wrap items-center gap-1.5">
                {BOARD_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={`Фон ${c}`}
                    aria-pressed={color === c}
                    className={`h-7 w-7 rounded-full border-2 transition hover:scale-110 ${
                      color === c ? "border-foreground" : "border-edge"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setColor(null)}
                  aria-pressed={color === null}
                  className={`flex h-7 items-center rounded-full border-2 border-dashed px-2.5 text-xs transition hover:text-foreground ${
                    color === null
                      ? "border-foreground text-foreground"
                      : "border-edge text-muted"
                  }`}
                >
                  Без фона
                </button>
              </div>
            </div>

            {state?.error && (
              <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {state.error}
              </p>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-edge px-4 py-2 text-sm text-muted transition hover:bg-surface-2"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold transition hover:bg-accent-hover disabled:opacity-50"
              >
                {pending ? "Сохраняем…" : "Сохранить"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
