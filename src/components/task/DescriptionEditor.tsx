"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fileEmbed, insertEmbedAtCursor, normalizeNewlines } from "@/lib/attachments";
import type { AttachmentDTO } from "@/lib/types";
import { AttachmentUploader } from "./AttachmentUploader";
import { TaskDescription } from "./TaskDescription";
import { useAttachmentUpload } from "./useAttachmentUpload";

/**
 * Описание задачи с правкой по клику и вложениями прямо в тексте.
 *
 * Вместо EditableText из @toimetdev/pathlogs-core: тот сохраняет по потере
 * фокуса, а здесь в режиме правки есть кнопка «прикрепить» и предпросмотр —
 * клик по ним уводил бы фокус и закрывал правку. Поэтому сохранение явное.
 */
export function DescriptionEditor({
  taskId,
  value,
  attachments,
  onSave,
}: {
  taskId: string;
  value: string;
  /** Вложения задачи: из них берутся файлы, вставленные в описание. */
  attachments: AttachmentDTO[];
  onSave: (fields: Record<string, string>) => Promise<void>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => normalizeNewlines(value));
  // Файлы, загруженные прямо из редактора: на сервере они уже вложения
  // задачи, но страница перерисуется только после сохранения — до этого
  // превью берётся отсюда.
  const [fresh, setFresh] = useState<AttachmentDTO[]>([]);
  const [pending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const target = useMemo(() => ({ taskId }), [taskId]);
  // Вставка картинки из буфера в само поле: та же загрузка, что и у зоны
  // «прикрепить», просто вызванная из обработчика textarea.
  const pasted = useAttachmentUpload(target, attach);

  const known = [...attachments, ...fresh];

  function attach(attachment: AttachmentDTO) {
    setFresh((prev) => [...prev, attachment]);
    const area = textareaRef.current;
    const next = insertEmbedAtCursor(
      draft,
      fileEmbed(attachment.id),
      area?.selectionStart ?? draft.length
    );
    setDraft(next.text);
    // Курсор — после вставки, чтобы можно было продолжать писать
    requestAnimationFrame(() => {
      area?.focus();
      area?.setSelectionRange(next.cursor, next.cursor);
    });
  }

  function save() {
    startTransition(async () => {
      // Сравниваем с нормализованным исходником: иначе невидимая разница
      // в переводах строк считалась бы правкой и писалась в историю.
      if (draft.trim() !== normalizeNewlines(value).trim()) {
        await onSave({ description: draft.trim() });
      }
      setEditing(false);
      setFresh([]);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <div
        role="button"
        tabIndex={0}
        data-tip="Нажмите, чтобы редактировать"
        onClick={() => {
          setDraft(normalizeNewlines(value));
          setEditing(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setDraft(normalizeNewlines(value));
            setEditing(true);
          }
        }}
        className={`cursor-text rounded-lg outline-none transition hover:bg-surface-2/40 focus-visible:bg-surface-2/40 ${
          pending ? "opacity-50" : ""
        }`}
      >
        <TaskDescription
          text={value}
          attachments={attachments}
          emptyHint="Добавьте описание… (поддерживается markdown, можно вставлять файлы)"
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <textarea
        ref={textareaRef}
        autoFocus
        rows={8}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setDraft(normalizeNewlines(value));
            setEditing(false);
          }
        }}
        onPaste={(e) => {
          // Картинку из буфера сразу делаем вложением: иначе её некуда
          // положить — в описании хранится только текст.
          const files = Array.from(e.clipboardData.files);
          if (files.length === 0) return;
          e.preventDefault();
          void pasted.upload(files);
        }}
        placeholder="Детали, контекст, критерии приёмки…"
        className="w-full rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
      />

      {pasted.error && <p className="text-sm text-danger-text">{pasted.error}</p>}

      <AttachmentUploader compact target={target} onUploaded={attach} />

      {draft.trim() && (
        <details className="rounded-lg border border-edge bg-surface-2/40 px-3 py-2">
          <summary className="cursor-pointer text-xs text-muted">
            Предпросмотр
          </summary>
          <div className="mt-2">
            <TaskDescription text={draft} attachments={known} />
          </div>
        </details>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold transition hover:bg-accent-hover disabled:opacity-50"
        >
          {pending ? "Сохраняем…" : "Сохранить"}
        </button>
        <button
          type="button"
          onClick={() => {
            setDraft(normalizeNewlines(value));
            setEditing(false);
          }}
          disabled={pending}
          className="rounded-lg border border-edge px-3 py-1.5 text-xs text-muted transition hover:bg-surface-2 disabled:opacity-50"
        >
          Отмена
        </button>
        <span className="text-xs text-muted">
          Markdown · файлы вставляются в место курсора
        </span>
      </div>
    </div>
  );
}
