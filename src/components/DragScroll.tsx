"use client";

import type { ReactNode } from "react";
import { useDragScroll, type DragScrollOptions } from "./useDragScroll";

/**
 * Контейнер с прокруткой протяжкой мыши — для мест, где своего клиентского
 * компонента нет (серверные страницы: вкладки проекта, широкие таблицы).
 * Классы прокрутки (`overflow-x-auto` и прочее) задаёт вызывающий код.
 */
export function DragScroll({
  children,
  className,
  axis,
  momentum,
  ...rest
}: DragScrollOptions & {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
  role?: string;
}) {
  const ref = useDragScroll<HTMLDivElement>({ axis, momentum });

  return (
    <div ref={ref} className={className} {...rest}>
      {children}
    </div>
  );
}
