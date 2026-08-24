"use client";

// Обёртка над CommandPalette из @toimetdev/pathlogs-core. Пакетная палитра
// дженерик: локальные пункты приходят пропом items, серверный поиск — search.
// Обёртка кормит её навигацией приложения и полнотекстовым searchAction,
// а также открывает палитру по событию cmdk:open (кнопка в сайдбаре).
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CommandPalette as BaseCommandPalette, type CommandItem } from "@toimetdev/pathlogs-core";
import { searchAction } from "@/lib/actions/search";

const NAV = [
  { label: "Проекты", href: "/dashboard", keys: "g d" },
  { label: "Мои задачи", href: "/my", keys: "g m" },
  { label: "Уведомления", href: "/notifications", keys: "g n" },
  { label: "Профиль", href: "/profile", keys: "g p" },
];

/** Командная палитра (⌘K / Ctrl+K): быстрый переход к проектам, задачам и разделам. */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Кнопка «Поиск…» в сайдбаре открывает палитру событием (мышь/тач).
  useEffect(() => {
    const openIt = () => setOpen(true);
    window.addEventListener("cmdk:open", openIt);
    return () => window.removeEventListener("cmdk:open", openIt);
  }, []);

  const items = useMemo<CommandItem[]>(
    () =>
      NAV.map((n) => ({
        id: "nav:" + n.href,
        group: "Навигация",
        title: n.label,
        hint: n.keys,
        onSelect: () => router.push(n.href),
      })),
    [router]
  );

  const search = useCallback(
    async (query: string): Promise<CommandItem[]> => {
      const r = await searchAction(query);
      return [
        ...r.projects.map((p) => ({
          id: "p:" + p.id,
          group: "Проекты",
          title: p.name,
          badge: p.key,
          onSelect: () => router.push(`/projects/${p.id}`),
        })),
        ...r.tasks.map((t) => ({
          id: "t:" + t.id,
          group: "Задачи",
          title: t.title,
          badge: `${t.projectKey}-${t.number}`,
          onSelect: () => router.push(`/tasks/${t.id}`),
        })),
      ];
    },
    [router]
  );

  return (
    <BaseCommandPalette
      open={open}
      onOpenChange={setOpen}
      // ⌘K регистрируется в компоненте Hotkeys (он же строит справку) и
      // открывает палитру событием cmdk:open — иначе клавиша сработала бы дважды.
      hotkey={null}
      items={items}
      search={search}
      labels={{
        placeholder: "Поиск проектов, задач, разделов…",
        empty: "Ничего не найдено",
        navigate: "перейти",
        select: "открыть",
      }}
    />
  );
}
