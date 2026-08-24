"use client";

// Липкая навигация по разделам карточки задачи теперь на SectionNav из
// @toimetdev/pathlogs-core (то же поведение: клик — плавный скролл, активный
// пункт по мере прокрутки, бейджи-счётчики, протяжка ряда на мобильном).
// Обёртка задаёт русскую метку и сохраняет тип TaskSectionDTO для страницы.
import { SectionNav, type NavSection } from "@toimetdev/pathlogs-core";

export type TaskSectionDTO = NavSection;

export function TaskSectionNav({ sections }: { sections: TaskSectionDTO[] }) {
  return <SectionNav sections={sections} aria-label="Разделы задачи" />;
}
