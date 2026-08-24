"use client";

// Обёртка над ThemeToggle из @toimetdev/pathlogs-core с русскими подписями.
// Ключ хранилища по умолчанию ("theme") совпадает с themeScript() в layout.
import { ThemeToggle as BaseThemeToggle } from "@toimetdev/pathlogs-core";

export function ThemeToggle() {
  return (
    <BaseThemeToggle
      labels={{
        toDark: "Тёмная тема",
        toLight: "Светлая тема",
        action: "Переключить тему",
      }}
    />
  );
}
