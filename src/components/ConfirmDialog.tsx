"use client";

// Тонкая обёртка над ConfirmDialog из @toimetdev/pathlogs-core: пакетная версия
// по умолчанию англоязычна, а по проекту нужны русские подписи. Обёртка задаёт
// их дефолтами — call-site может по-прежнему переопределить любую подпись.
import {
  ConfirmDialog as BaseConfirmDialog,
  type ConfirmDialogProps,
  type ConfirmTone,
} from "@toimetdev/pathlogs-core";

export type { ConfirmTone };

export function ConfirmDialog(props: ConfirmDialogProps) {
  return (
    <BaseConfirmDialog
      confirmLabel="Подтвердить"
      cancelLabel="Отмена"
      pendingLabel="Выполняем…"
      {...props}
    />
  );
}
