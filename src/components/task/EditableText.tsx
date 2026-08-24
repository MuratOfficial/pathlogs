"use client";

// Адаптер над EditableText из @toimetdev/pathlogs-core. Пакетная версия
// дженерик: onSave принимает строку. У задачи же правится конкретное поле
// (title/description) через updateTaskFieldsAction(taskId, fields), поэтому
// обёртка заворачивает строку в { [field]: next } и задаёт русскую подсказку.
import { EditableText as BaseEditableText } from "@toimetdev/pathlogs-core";

export function EditableText({
  value,
  field,
  onSave,
  big = false,
  multiline = false,
  markdown = false,
  placeholder = "—",
}: {
  value: string;
  field: "title" | "description";
  onSave: (fields: Record<string, string>) => Promise<void>;
  big?: boolean;
  multiline?: boolean;
  markdown?: boolean;
  placeholder?: string;
}) {
  return (
    <BaseEditableText
      value={value}
      big={big}
      multiline={multiline}
      markdown={markdown}
      placeholder={placeholder}
      tip="Нажмите, чтобы редактировать"
      onSave={(next) => onSave({ [field]: next })}
    />
  );
}
