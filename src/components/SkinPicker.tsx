"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_SKIN, getSkin, setSkin, SKINS, subscribeSkin, type Skin } from "@/lib/skin";

/**
 * Выбор оформления. Сервер про выбор не знает — он живёт в localStorage и в
 * атрибуте на <html>, — поэтому первый снимок здесь всегда DEFAULT_SKIN, а
 * реальное значение приезжает сразу после гидратации. Это штатный режим
 * useSyncExternalStore, а не рассинхрон разметки.
 *
 * Сам переключатель ничего не перерисовывает: он меняет атрибут, дальше
 * работает CSS.
 */
export function SkinPicker() {
  const skin = useSyncExternalStore<Skin>(subscribeSkin, getSkin, () => DEFAULT_SKIN);

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {SKINS.map((option) => {
        const active = option.id === skin;
        return (
          <label
            key={option.id}
            className={`group flex cursor-pointer flex-col gap-3 rounded-xl border p-3 transition ${
              active
                ? "border-accent bg-accent/10"
                : "border-edge bg-surface-2 hover:border-accent/50"
            }`}
          >
            <input
              type="radio"
              name="skin"
              value={option.id}
              checked={active}
              onChange={() => setSkin(option.id)}
              className="sr-only"
            />

            {/* Миниатюра: те же три цвета, что даёт скин — фон, поверхность, акцент. */}
            <span
              aria-hidden
              className="flex h-14 items-end gap-1.5 rounded-lg p-2"
              style={{ background: option.swatch[0] }}
            >
              <span
                className="h-full flex-1 rounded"
                style={{ background: option.swatch[1] }}
              />
              <span
                className="h-full w-1/3 rounded"
                style={{ background: option.swatch[2] }}
              />
            </span>

            <span>
              <span className="flex items-center gap-2 text-sm font-semibold">
                {option.name}
                {active && (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Выбрано
                  </span>
                )}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-muted">
                {option.hint}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
