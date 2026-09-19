/**
 * Свёрнутое боковое меню.
 *
 * Устроено как тема и оформление: атрибут [data-sidebar] на <html> читает CSS,
 * localStorage переживает перезагрузку, источник правды — атрибут. Прятать
 * меню состоянием React нельзя: оно живёт в серверном layout, а выбор должен
 * действовать до первой отрисовки, иначе меню мигнёт и страница дёрнется.
 *
 * Касается только десктопа: на узком экране меню и так выезжающее, там прятать
 * нечего. Правила в globals.css поэтому лежат внутри @media (min-width: 1024px).
 */

export type SidebarState = "open" | "hidden";

export const SIDEBAR_STORAGE_KEY = "sidebar";

export const DEFAULT_SIDEBAR: SidebarState = "open";

export function isSidebarState(value: unknown): value is SidebarState {
  return value === "open" || value === "hidden";
}

/** Текущее состояние (по атрибуту на <html>). */
export function getSidebar(): SidebarState {
  if (typeof document === "undefined") return DEFAULT_SIDEBAR;
  const attr = document.documentElement.getAttribute("data-sidebar");
  return isSidebarState(attr) ? attr : DEFAULT_SIDEBAR;
}

/**
 * Запоминает выбор. Запись в localStorage может упасть (приватный режим) —
 * это не повод не свернуть меню: на экране оно уже свёрнуто.
 */
export function setSidebar(state: SidebarState): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-sidebar", state);
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, state);
  } catch {
    /* хранилище недоступно — выбор просто не переживёт перезагрузку */
  }
}

export function toggleSidebar(): SidebarState {
  const next: SidebarState = getSidebar() === "hidden" ? "open" : "hidden";
  setSidebar(next);
  return next;
}

/** Подписка на смену состояния: кнопок две, и обе должны знать о нажатии. */
export function subscribeSidebar(callback: () => void): () => void {
  if (typeof document === "undefined") return () => {};
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-sidebar"],
  });
  return () => observer.disconnect();
}

/**
 * Скрипт для <head>: ставит атрибут до первой отрисовки. Без него свёрнутое
 * меню на мгновение показывалось бы, а содержимое страницы прыгало бы влево.
 */
export function sidebarScript(): string {
  const key = JSON.stringify(SIDEBAR_STORAGE_KEY);
  const fallback = JSON.stringify(DEFAULT_SIDEBAR);
  return `(function(){try{var s=localStorage.getItem(${key});if(s!=="open"&&s!=="hidden")s=${fallback};document.documentElement.setAttribute("data-sidebar",s)}catch(e){document.documentElement.setAttribute("data-sidebar",${fallback})}})()`;
}
