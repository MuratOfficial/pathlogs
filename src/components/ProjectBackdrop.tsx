import { projectBackgroundCss, type ProjectBackgroundDTO } from "@/lib/background";

/**
 * Подложка проекта: тонирует весь экран персональным фоном пользователя.
 * Fixed на весь вьюпорт и полупрозрачная, поэтому одинаково работает
 * в тёмной и светлой теме и не мешает читать текст.
 */
export function ProjectBackdrop({
  background,
}: {
  background: ProjectBackgroundDTO | null;
}) {
  if (!background) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
      style={{ background: projectBackgroundCss(background) }}
    />
  );
}
