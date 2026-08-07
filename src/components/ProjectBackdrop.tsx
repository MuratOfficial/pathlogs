/**
 * Фоновая подложка проекта: тонирует весь экран цветом проекта.
 * Полупрозрачная и на весь вьюпорт (fixed), поэтому одинаково работает
 * и в тёмной, и в светлой теме и не мешает читать текст.
 */
export function ProjectBackdrop({ color }: { color: string | null }) {
  if (!color) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
      style={{
        background: `radial-gradient(120% 80% at 12% 0%, ${color}33, transparent 62%), ${color}14`,
      }}
    />
  );
}
