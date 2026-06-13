"use client";

import { useRef, useState } from "react";
import type { MemberDTO } from "@/lib/types";

/**
 * Textarea с автодополнением @упоминаний участников проекта. Сами id упомянутых
 * хранятся в скрытом поле name="mentions" (csv) — это надёжный источник для
 * уведомлений, не зависящий от точного совпадения текста.
 */
export function MentionTextarea({
  name,
  members,
  placeholder,
  rows = 2,
  className = "",
}: {
  name: string;
  members: MemberDTO[];
  placeholder?: string;
  rows?: number;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState("");
  const [mentioned, setMentioned] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState<string | null>(null); // текст после @ (null — меню закрыто)
  const [atPos, setAtPos] = useState(0);

  const matches =
    query === null
      ? []
      : members
          .filter((m) => m.name.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 6);

  function onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    setValue(v);
    const caret = e.target.selectionStart ?? v.length;
    // Ищем @ перед курсором без пробела внутри хвоста
    const before = v.slice(0, caret);
    const m = /@([^\s@]*)$/.exec(before);
    if (m) {
      setAtPos(caret - m[1].length - 1);
      setQuery(m[1]);
    } else {
      setQuery(null);
    }
  }

  function pick(member: MemberDTO) {
    const ta = ref.current;
    if (!ta) return;
    const caret = ta.selectionStart ?? value.length;
    const next = value.slice(0, atPos) + `@${member.name} ` + value.slice(caret);
    setValue(next);
    setMentioned((prev) => new Set(prev).add(member.id));
    setQuery(null);
    // Вернём фокус и поставим курсор после вставки
    requestAnimationFrame(() => {
      ta.focus();
      const pos = atPos + member.name.length + 2;
      ta.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="relative">
      <input type="hidden" name="mentions" value={[...mentioned].join(",")} />
      <textarea
        ref={ref}
        name={name}
        value={value}
        rows={rows}
        onChange={onChange}
        onKeyDown={(e) => {
          if (query !== null && matches.length > 0 && (e.key === "Enter" || e.key === "Tab")) {
            e.preventDefault();
            pick(matches[0]!);
          }
          if (e.key === "Escape") setQuery(null);
        }}
        placeholder={placeholder}
        className={className}
      />
      {query !== null && matches.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-44 w-56 overflow-y-auto rounded-xl border border-edge bg-surface-2 p-1 shadow-xl">
          {matches.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(m);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-surface"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/25 text-[9px] font-bold text-accent-hover">
                  {m.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("")}
                </span>
                {m.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
