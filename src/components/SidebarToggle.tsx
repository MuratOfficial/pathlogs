"use client";

import { useSyncExternalStore } from "react";
import {
  DEFAULT_SIDEBAR,
  getSidebar,
  subscribeSidebar,
  toggleSidebar,
  type SidebarState,
} from "@/lib/sidebar";

/**
 * Кнопка «свернуть меню». Рисуется дважды:
 *
 * - `inline` — в шапке меню, рядом с логотипом; прячется вместе с меню;
 * - `floating` — прижата к левому краю и видна только когда меню свёрнуто,
 *   иначе развернуть его было бы нечем.
 *
 * Видимостью управляет CSS по атрибуту [data-sidebar], а не React: состояние
 * ставится до гидратации, и кнопка не должна мигать вместе с ней.
 */
export function SidebarToggle({ variant }: { variant: "inline" | "floating" }) {
  const state = useSyncExternalStore<SidebarState>(
    subscribeSidebar,
    getSidebar,
    () => DEFAULT_SIDEBAR
  );
  const hidden = state === "hidden";
  const label = hidden ? "Показать меню" : "Свернуть меню";

  return (
    <button
      type="button"
      onClick={() => toggleSidebar()}
      data-tip={`${label} (Ctrl+B)`}
      aria-label={label}
      aria-expanded={!hidden}
      className={
        variant === "inline"
          ? "app-sidebar-collapse hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-foreground lg:flex"
          : "app-sidebar-expand fixed left-2 top-2 z-30 hidden h-8 w-8 items-center justify-center rounded-lg border border-edge bg-surface text-muted shadow transition hover:bg-surface-2 hover:text-foreground"
      }
    >
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
        aria-hidden
      >
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M9 4v16" />
        {/* Стрелка внутри узкой части: показывает, куда уедет меню. */}
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d={hidden ? "M13.5 9.5l2.5 2.5-2.5 2.5" : "M16 9.5L13.5 12l2.5 2.5"}
        />
      </svg>
    </button>
  );
}
