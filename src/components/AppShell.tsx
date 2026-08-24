"use client";

// Обёртка над AppShell из @toimetdev/pathlogs-core: адаптивный сайдбар
// (статичный на десктопе, drawer на мобильном) живёт в пакете. Обёртка задаёт
// брендовый блок в мобильной шапке и русское имя кнопки-гамбургера.
import { AppShell as BaseAppShell } from "@toimetdev/pathlogs-core";

const brand = (
  <span className="flex items-center gap-2">
    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-accent via-accent-2 to-accent-pink text-sm font-bold text-white">
      P
    </span>
    <span className="text-sm font-bold tracking-tight">PathLogs</span>
  </span>
);

export function AppShell({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <BaseAppShell sidebar={sidebar} brand={brand} menuLabel="Открыть меню">
      {children}
    </BaseAppShell>
  );
}
