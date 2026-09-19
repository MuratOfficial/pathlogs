"use client";

import { useEffect } from "react";
import { subscribeTheme } from "@toimetdev/pathlogs-tokens";
import { subscribeSkin } from "@/lib/skin";

/**
 * Держит <meta name="theme-color"> в согласии с выбранным оформлением.
 *
 * Зачем: этим цветом браузер красит свою обвязку — строку состояния на
 * Android и шапку установленного PWA (манифест у нас есть, appleWebApp тоже).
 * Значение в layout.tsx статично, потому что метаданные Next считаются на
 * сервере, а скин живёт в браузере, — и под Linear тёмно-синяя полоса
 * оказывалась бы чужой над почти чёрной страницей.
 *
 * Цвет не перечисляем списком, а читаем из той же переменной, что красит
 * body: так любой новый скин и светлая тема подхватываются сами.
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
    const stopTheme = subscribeTheme(apply);
    const stopSkin = subscribeSkin(apply);
    return () => {
      stopTheme();
      stopSkin();
    };
  }, []);

  return null;
}
