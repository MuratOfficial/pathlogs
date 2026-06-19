"use client";

import { useState, useTransition } from "react";
import { Markdown } from "@/components/Markdown";

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
  /** Рендерить значение как ограниченный Markdown (режим просмотра). */
  markdown?: boolean;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [pending, startTransition] = useTransition();

  function save() {
    setEditing(false);
    if (draft.trim() === value.trim()) return;
    startTransition(() => onSave({ [field]: draft.trim() }));
  }

  if (editing) {
    return multiline ? (
      <textarea
        autoFocus
        value={draft}
        rows={5}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        className="w-full rounded-lg border border-accent bg-surface-2 px-3 py-2 text-sm outline-none"
      />
    ) : (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && save()}
        className={`w-full rounded-lg border border-accent bg-surface-2 px-3 py-2 outline-none ${
          big ? "text-xl font-bold" : "text-sm"
        }`}
      />
    );
  }

  return (
    <div
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      data-tip="Нажмите, чтобы редактировать"
      className={`cursor-text rounded-lg px-1 -mx-1 transition hover:bg-surface-2/60 ${
        pending ? "opacity-50" : ""
      } ${big ? "text-xl font-bold tracking-tight" : markdown ? "text-sm" : "whitespace-pre-wrap text-sm text-foreground/85"} ${
        !value ? "text-muted/60" : ""
      }`}
    >
      {value ? (markdown && multiline ? <Markdown text={value} /> : value) : placeholder}
    </div>
  );
}
