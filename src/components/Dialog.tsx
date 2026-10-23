"use client";

// Обёртка над Dialog из @toimetdev/pathlogs-core — им пользуются все окна
// приложения. Пакет даёт затемнение, портал, ловушку фокуса и Escape; обёртка
// добавляет кнопку «Закрыть» в углу. Кнопка последняя в DOM: пакет при открытии
// ставит фокус на первый интерактивный элемент, и это должно быть первое поле
// формы, а не крестик.
//
// Внутри <DialogInline> то же окно рисуется секцией страницы: так страница
// настроек проекта собирает настройки, которые раньше открывались окнами,
// без второй копии их форм. Компонент окна узнаёт режим через useDialogInline()
// и в нём не рисует кнопку-триггер и кнопки, которые только закрывают окно.
import { createContext, useContext, type ReactNode } from "react";
import { Dialog as BaseDialog, type DialogProps as BaseDialogProps } from "@toimetdev/pathlogs-core";
import { Icon } from "@/components/ui/Icon";
import { Card, SectionTitle } from "@/components/ui/Card";

const InlineContext = createContext(false);

/** Окна внутри рисуются секциями страницы, а не модально. */
export function DialogInline({ children }: { children: ReactNode }) {
  return <InlineContext.Provider value={true}>{children}</InlineContext.Provider>;
}

/** true — окно показано секцией страницы: триггер и «Закрыть» не нужны. */
export function useDialogInline() {
  return useContext(InlineContext);
}

export type DialogProps = Omit<BaseDialogProps, "header" | "label" | "title"> & {
  /** Заголовок окна; он же доступное имя для скринридера. */
  title: string;
};

export function Dialog({ title, onClose, className, children, ...props }: DialogProps) {
  const inline = useContext(InlineContext);
  if (inline) {
    return (
      <Card as="section" aria-label={title}>
        <SectionTitle className="mb-4">{title}</SectionTitle>
        {children}
      </Card>
    );
  }
  return (
    <BaseDialog
      {...props}
      onClose={onClose}
      label={title}
      header={<h2 className="pl-dialog__title pr-8">{title}</h2>}
      className={`relative${className ? ` ${className}` : ""}`}
    >
      {children}
      <button
        type="button"
        onClick={onClose}
        aria-label="Закрыть"
        className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-foreground"
      >
        <Icon name="close" className="h-5 w-5" />
      </button>
    </BaseDialog>
  );
}
