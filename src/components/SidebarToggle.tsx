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
 * Кнопка «свернуть / развернуть меню» в шапке сайдбара. Только на десктопе:
 * на узком экране меню и так выезжающее.
 *
 * Свёрнутое меню не исчезает, а сжимается в рейку с иконками (globals.css,
 * [data-sidebar="hidden"]), и кнопка остаётся в ней — второй, плавающей
 * кнопки для разворачивания не нужно.
 */
export function SidebarToggle() {
  const state = useSyncExternalStore<SidebarState>(
    subscribeSidebar,
    getSidebar,
    () => DEFAULT_SIDEBAR
  );
  const hidden = state === "hidden";
  const label = hidden ? "Развернуть меню" : "Свернуть меню";

  return (
    <button
      type="button"
      onClick={() => toggleSidebar()}
      data-tip={`${label} (Ctrl+B)`}
      aria-label={label}
      aria-expanded={!hidden}
      className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-foreground lg:flex"
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
