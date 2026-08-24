// Прокрутка протяжкой мыши теперь в @toimetdev/pathlogs-hooks (та же механика:
// инерция, растворение краёв, автопрокрутка при перетаскивании; атрибуты
// data-pl-* стилизует scroll.css). Реэкспорт сохраняет импорты `./useDragScroll`.
export { useDragScroll, type DragScrollOptions } from "@toimetdev/pathlogs-hooks";
