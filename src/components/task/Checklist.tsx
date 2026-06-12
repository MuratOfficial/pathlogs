"use client";

import { useState, useTransition } from "react";
import {
  addChecklistItemAction,
  toggleChecklistItemAction,
  updateChecklistItemAction,
  deleteChecklistItemAction,
} from "@/lib/actions/tasks";
import { MarkdownInline } from "@/components/Markdown";

export interface ChecklistItemDTO {
  id: string;
  text: string;
  done: boolean;
}

function Item({ item }: { item: ChecklistItemDTO }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);
  const [pending, startTransition] = useTransition();

  function saveText() {
    setEditing(false);
    if (draft.trim() === item.text || !draft.trim()) return;
    startTransition(() => updateChecklistItemAction(item.id, draft.trim()));
  }

  return (
    <li
      className={`group flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-surface-2/60 ${
        pending ? "opacity-50" : ""
      }`}
    >
      <input
        type="checkbox"
        checked={item.done}
        onChange={(e) =>
          startTransition(() => toggleChecklistItemAction(item.id, e.target.checked))
        }
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-indigo-500"
      />
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={saveText}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveText();
            if (e.key === "Escape") setEditing(false);
          }}
          className="w-full rounded border border-accent bg-surface-2 px-2 py-0.5 text-sm outline-none"
        />
      ) : (
        <span
          onClick={() => {
            setDraft(item.text);
            setEditing(true);
          }}
          title="Нажмите, чтобы редактировать"
          className={`min-w-0 flex-1 cursor-text text-sm ${
            item.done ? "text-muted line-through decoration-muted/60" : "text-foreground/90"
          }`}
        >
          <MarkdownInline text={item.text} />
        </span>
      )}
      <button
        type="button"
        title="Удалить пункт"
        onClick={() => startTransition(() => deleteChecklistItemAction(item.id))}
        className="invisible shrink-0 rounded p-0.5 text-muted transition hover:text-red-400 group-hover:visible"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </li>
  );
}

export function Checklist({
  taskId,
  items,
}: {
  taskId: string;
  items: ChecklistItemDTO[];
}) {
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  const done = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  function add() {
    const value = text.trim();
    if (!value) return;
    setText("");
    startTransition(() => addChecklistItemAction(taskId, value));
  }

  return (
    <div>
      {items.length > 0 && (
        <div className="mb-3 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div
              className={`h-full rounded-full transition-all ${pct === 100 ? "bg-emerald-500" : "bg-accent"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="shrink-0 text-xs font-medium text-muted">
            {done} / {items.length} · {pct}%
          </span>
        </div>
      )}

      <ul className="space-y-0.5">
        {items.map((i) => (
          <Item key={i.id} item={i} />
        ))}
      </ul>

      <div className="mt-2 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Новый пункт… (поддерживается **markdown**)"
          className="w-full rounded-lg border border-edge bg-surface-2 px-3 py-1.5 text-sm outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={add}
          disabled={pending || !text.trim()}
          className="shrink-0 rounded-lg border border-edge px-3 py-1.5 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-foreground disabled:opacity-40"
        >
          Добавить
        </button>
      </div>
    </div>
  );
}
