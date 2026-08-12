/** Персональный фон проекта: цвет, второй цвет градиента и его направление. */
export interface ProjectBackgroundDTO {
  color: string;
  /** null — однотонный фон без градиента */
  colorTo: string | null;
  /** Направление градиента в градусах */
  angle: number;
}

/** Цвет фона в hex-формате #rrggbb (проверяется и на клиенте, и на сервере). */
export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/**
 * CSS-фон проекта. Цвета берём с прозрачностью: фон подкрашивает страницу,
 * но не спорит с текстом и одинаково работает в тёмной и светлой теме.
 * Одна функция на подложку и на превью в диалоге — они не разъедутся.
 */
export function projectBackgroundCss(bg: ProjectBackgroundDTO): string {
  if (bg.colorTo) {
    return `linear-gradient(${bg.angle}deg, ${bg.color}4d, ${bg.colorTo}4d)`;
  }
  return `radial-gradient(120% 80% at 12% 0%, ${bg.color}4d, transparent 62%), ${bg.color}1a`;
}
