"use client";

// Обёртка над AppShell из @toimetdev/pathlogs-core: адаптивный сайдбар
// (статичный на десктопе, drawer на мобильном) живёт в пакете. Обёртка задаёт
// брендовый блок в мобильной шапке и русское имя кнопки-гамбургера.
import { AppShell as BaseAppShell } from "@toimetdev/pathlogs-core";
import { BrandMark } from "@/components/BrandMark";

const brand = (
  <span className="flex items-center gap-2">
    <BrandMark className="h-7 w-7 rounded-lg" />
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
