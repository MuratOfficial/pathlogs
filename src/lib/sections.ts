/** Позиция блока: верхняя граница относительно окна (getBoundingClientRect().top). */
export interface SectionPosition {
  id: string;
  top: number;
}

/**
 * Какой блок считать активным в навигации по карточке задачи.
 *
 * Активен последний блок, чья верхняя граница уже прошла линию `line`
 * (низ липкой панели). Пока не проскроллили ни до одного — активен первый.
 * У самого низа страницы подсвечиваем последний блок: короткие блоки в конце
 * физически не могут подняться к линии, иначе они никогда не подсветятся.
 */
export function activeSectionId(
  positions: SectionPosition[],
  line: number,
  atBottom: boolean
): string | null {
  if (positions.length === 0) return null;
  if (atBottom) return positions[positions.length - 1]!.id;

  let current = positions[0]!.id;
  for (const p of positions) {
    if (p.top <= line) current = p.id;
  }
  return current;
}
