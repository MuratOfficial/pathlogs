"use client";

// Глобальные горячие клавиши и экран справки теперь на useHotkeys/HotkeysHelp
// из фреймворка. HotkeysHelp сам регистрирует переданный список через
// useHotkeys (и добавляет «?» для вызова справки) — отдельный useHotkeys не
// нужен, а справка и обработчики гарантированно не разъезжаются.
import { useRouter } from "next/navigation";
import { HotkeysHelp } from "@toimetdev/pathlogs-core";
import type { Hotkey } from "@toimetdev/pathlogs-hooks";

/** Глобальные горячие клавиши с «лидером» g (g d, g m, …) и помощью по «?». */
export function Hotkeys() {
  const router = useRouter();

  const hotkeys: Hotkey[] = [
    { keys: "g d", label: "Проекты (дашборд)", group: "Навигация", handler: () => router.push("/dashboard") },
    { keys: "g m", label: "Мои задачи", group: "Навигация", handler: () => router.push("/my") },
    { keys: "g n", label: "Уведомления", group: "Навигация", handler: () => router.push("/notifications") },
    { keys: "g p", label: "Профиль", group: "Навигация", handler: () => router.push("/profile") },
    {
      keys: "mod+k",
      label: "Командная палитра (поиск)",
      group: "Навигация",
      allowInInput: true,
      handler: () => window.dispatchEvent(new Event("cmdk:open")),
    },
    // Клавиши доски обрабатывает сам KanbanBoard по карточке в фокусе —
    // здесь они только для справки (enabled: false, глобально не срабатывают).
    { keys: "enter", label: "Открыть карточку в фокусе (канбан)", group: "Доска", enabled: false, handler: () => {} },
    { keys: "d", label: "Отметить карточку в фокусе выполненной", group: "Доска", enabled: false, handler: () => {} },
  ];

  return (
    <HotkeysHelp
      hotkeys={hotkeys}
      title="Горячие клавиши"
      hint="«g» — лидер: нажмите g, затем вторую клавишу."
    />
  );
}
