"use client";

import { useEffect } from "react";
import { subscribeTheme } from "@toimetdev/pathlogs-tokens";

/**
 * Держит <meta name="theme-color"> в согласии с выбранной темой.
 *
 * Зачем: этим цветом браузер красит свою обвязку — строку состояния на
 * Android и шапку установленного PWA (манифест у нас есть, appleWebApp тоже).
 * Значение в layout.tsx статично, потому что метаданные Next считаются на
 * сервере, а тема живёт в браузере, — и в светлой теме тёмно-синяя полоса
 * оказывалась бы чужой над белой страницей.
 *
 * Цвет не перечисляем списком, а читаем из той же переменной, что красит
 * body: так любая тема подхватывается сама.
 */
export function ThemeColorMeta() {
  useEffect(() => {
    const apply = () => {
      const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
      if (!meta) return;
      const background = getComputedStyle(document.documentElement)
        .getPropertyValue("--background")
        .trim();
      if (background) meta.content = background;
    };

    apply();
    return subscribeTheme(apply);
  }, []);

  return null;
}
