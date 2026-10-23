// Карточка и заголовок её раздела — два самых частых куска разметки в
// приложении. Раньше строка «rounded-2xl border border-edge bg-surface» была
// скопирована в 73 места с четырьмя разными отступами, а заголовок раздела —
// в 40 мест двух размеров. Теперь отступ один (p-5), размер заголовка один.
import type { ComponentProps, ElementType } from "react";

type CardProps<T extends ElementType> = {
  /** Тег или компонент корня; по умолчанию div. */
  as?: T;
  /** Без внутреннего отступа: таблицы, списки во всю ширину, свои отступы. */
  flush?: boolean;
  className?: string;
} & Omit<ComponentProps<T>, "as" | "className">;

export function Card<T extends ElementType = "div">({
  as,
  flush = false,
  className,
  ...rest
}: CardProps<T>) {
  const Tag: ElementType = as ?? "div";
  return (
    <Tag
      {...rest}
      className={`rounded-2xl border border-edge bg-surface${flush ? "" : " p-5"}${className ? ` ${className}` : ""}`}
    />
  );
}

type SectionTitleProps<T extends ElementType> = {
  /** Тег заголовка; по умолчанию h2. */
  as?: T;
  className?: string;
} & Omit<ComponentProps<T>, "as" | "className">;

/** Подпись раздела карточки: мелкие прописные буквы приглушённым цветом. */
export function SectionTitle<T extends ElementType = "h2">({
  as,
  className,
  ...rest
}: SectionTitleProps<T>) {
  const Tag: ElementType = as ?? "h2";
  return (
    <Tag
      {...rest}
      className={`text-xs font-semibold uppercase tracking-wide text-muted${className ? ` ${className}` : ""}`}
    />
  );
}
