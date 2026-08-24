// Markdown теперь живёт в @toimetdev/pathlogs-core (тот же ограниченный разбор
// без сырого HTML, логика вынесена в markdownParser и покрыта тестами).
// Реэкспорт сохраняет существующие импорты `@/components/Markdown`.
export { Markdown, MarkdownInline } from "@toimetdev/pathlogs-core";
