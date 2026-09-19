/**
 * Оформление («скин») — второй, независимый от темы переключатель внешнего
 * вида. Тема отвечает за светло/темно, скин — за палитру, радиусы и шрифт.
 *
 * Устроено так же, как тема в @toimetdev/pathlogs-tokens: атрибут
 * [data-skin] на <html> читает CSS, localStorage переживает перезагрузку,
 * источник правды — атрибут. Ни один компонент не знает про скины: всё
 * решается подменой CSS-переменных в globals.css, а Tailwind-утилиты
 * (bg-surface, rounded-lg, font-sans) собраны через var() и меняются вместе
 * с ними без пересборки.
 */

/** Значение атрибута [data-skin]. */
export type Skin = "aurora" | "linear" | "railway";

export const SKIN_STORAGE_KEY = "skin";

/** Оформление, которое действует, если пользователь ничего не выбирал. */
export const DEFAULT_SKIN: Skin = "aurora";

/** Описания для экрана выбора. Порядок здесь = порядок карточек. */
export const SKINS: ReadonlyArray<{
  id: Skin;
  name: string;
  hint: string;
  /** Три цвета для миниатюры: фон, поверхность, акцент. */
  swatch: [string, string, string];
}> = [
  {
    id: "aurora",
    name: "Aurora",
    hint: "Как сейчас: синий фон, индиго-акцент, мягкие градиенты.",
    swatch: ["#0b0f1a", "#1a2235", "#6366f1"],
  },
  {
    id: "linear",
    name: "Linear",
    hint: "Почти чёрный фон, тонкие границы, малые радиусы, шрифт Inter. Плотнее и тише.",
    swatch: ["#08090b", "#17181a", "#5e6ad2"],
  },
  {
    id: "railway",
    name: "Railway",
    hint: "Фиолетовый фон, крупные скругления, Inter и JetBrains Mono для кодов.",
    swatch: ["#13111c", "#241f31", "#a855f7"],
  },
];

/** Пришло ли из хранилища или из атрибута что-то, что мы умеем показывать. */
export function isSkin(value: unknown): value is Skin {
  return value === "aurora" || value === "linear" || value === "railway";
}

/** Текущее оформление (по атрибуту на <html>). */
export function getSkin(): Skin {
  if (typeof document === "undefined") return DEFAULT_SKIN;
  const attr = document.documentElement.getAttribute("data-skin");
  return isSkin(attr) ? attr : DEFAULT_SKIN;
}

/**
 * Применяет оформление: пишет атрибут и запоминает выбор.
 * Запись в localStorage может упасть (приватный режим) — это не повод
 * ронять переключатель, на экране скин уже сменился.
 */
export function setSkin(skin: Skin): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-skin", skin);
  try {
    localStorage.setItem(SKIN_STORAGE_KEY, skin);
  } catch {
    /* хранилище недоступно — выбор просто не переживёт перезагрузку */
  }
}

/** Подписка на смену оформления: кто-то переключил его в другой вкладке приложения. */
export function subscribeSkin(callback: () => void): () => void {
  if (typeof document === "undefined") return () => {};
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-skin"],
  });
  return () => observer.disconnect();
}

/**
 * Скрипт для <head>, снимающий FOUC: ставит атрибут до первой отрисовки,
 * иначе страница мигнёт чужой палитрой. Синхронный и крошечный —
 * он блокирует отрисовку, и это здесь именно то, что нужно.
 */
export function skinScript(): string {
  const key = JSON.stringify(SKIN_STORAGE_KEY);
  const fallback = JSON.stringify(DEFAULT_SKIN);
  return `(function(){try{var s=localStorage.getItem(${key});if(s!=="aurora"&&s!=="linear"&&s!=="railway")s=${fallback};document.documentElement.setAttribute("data-skin",s)}catch(e){document.documentElement.setAttribute("data-skin",${fallback})}})()`;
}
