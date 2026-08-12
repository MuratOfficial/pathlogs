"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setProjectBackgroundAction } from "@/lib/actions/projects";
import { PROJECT_BG_PALETTE } from "@/lib/labels";
import { projectBackgroundCss, type ProjectBackgroundDTO } from "@/lib/background";

const DEFAULT_COLOR = PROJECT_BG_PALETTE[0];
const DEFAULT_COLOR_TO = "#ec4899";
const DEFAULT_ANGLE = 160;

/** Ряд кружков палитры. */
function Palette({
  value,
  onPick,
  label,
}: {
  value: string;
  onPick: (c: string) => void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PROJECT_BG_PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onPick(c)}
          aria-label={`${label} ${c}`}
          aria-pressed={value === c}
          className={`h-7 w-7 rounded-full border-2 transition hover:scale-110 ${
            value === c ? "border-foreground" : "border-edge"
          }`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}

/**
 * Персональный фон проекта: цвет, градиент из двух цветов и его направление.
 * Фон личный — другие участники видят свой, поэтому доступен любому участнику.
 */
export function ProjectBackgroundDialog({
  projectId,
  background,
}: {
  projectId: string;
  background: ProjectBackgroundDTO | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState(background?.color ?? DEFAULT_COLOR);
  const [colorTo, setColorTo] = useState(background?.colorTo ?? DEFAULT_COLOR_TO);
  const [gradient, setGradient] = useState(background?.colorTo != null);
  const [angle, setAngle] = useState(background?.angle ?? DEFAULT_ANGLE);
  const [pending, startTransition] = useTransition();

  const preview: ProjectBackgroundDTO = {
    color,
    colorTo: gradient ? colorTo : null,
    angle,
  };

  function openDialog() {
    // Открываем всегда с сохранённым состоянием: несохранённый выбор не «залипает»
    setColor(background?.color ?? DEFAULT_COLOR);
    setColorTo(background?.colorTo ?? DEFAULT_COLOR_TO);
    setGradient(background?.colorTo != null);
    setAngle(background?.angle ?? DEFAULT_ANGLE);
    setOpen(true);
  }

  function save(next: ProjectBackgroundDTO | null) {
    startTransition(async () => {
      await setProjectBackgroundAction(projectId, next);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        data-tip="Фон проекта · виден только вам"
        aria-label="Фон проекта"
        className="rounded-lg p-1.5 text-muted transition hover:bg-surface-2 hover:text-foreground"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z" />
        </svg>
      </button>

      {open && (
        <div
          className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="animate-pop-in w-full max-w-md rounded-2xl border border-edge bg-surface p-6 shadow-2xl">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Фон проекта</h2>
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
            <p className="mb-4 text-xs text-muted">
              Виден только вам — у каждого участника проекта фон свой.
            </p>

            {/* Живое превью: ровно тот же CSS, что и у подложки страницы */}
            <div
              aria-hidden
              className="mb-4 h-20 rounded-xl border border-edge"
              style={{ background: projectBackgroundCss(preview) }}
            />

            <span className="mb-1.5 block text-sm text-muted">
              {gradient ? "Первый цвет" : "Цвет"}
            </span>
            <div className="mb-4">
              <Palette value={color} onPick={setColor} label="Цвет" />
            </div>

            <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-indigo-500"
                checked={gradient}
                onChange={(e) => setGradient(e.target.checked)}
              />
              Градиент из двух цветов
            </label>

            {gradient && (
              <>
                <span className="mb-1.5 block text-sm text-muted">Второй цвет</span>
                <div className="mb-4">
                  <Palette value={colorTo} onPick={setColorTo} label="Второй цвет" />
                </div>

                <label className="mb-5 block">
                  <span className="mb-1.5 flex items-center justify-between text-sm text-muted">
                    Направление
                    <span className="font-mono text-xs text-foreground">{angle}°</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    step={5}
                    value={angle}
                    onChange={(e) => setAngle(Number(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                </label>
              </>
            )}

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                disabled={pending || !background}
                onClick={() => save(null)}
                className="mr-auto rounded-lg border border-edge px-4 py-2 text-sm text-muted transition hover:bg-surface-2 hover:text-foreground disabled:opacity-40"
              >
                Убрать фон
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-edge px-4 py-2 text-sm text-muted transition hover:bg-surface-2"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => save(preview)}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold transition hover:bg-accent-hover disabled:opacity-50"
              >
                {pending ? "Сохраняем…" : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
