"use client";

import { useMemo, useRef } from "react";
import { embeddedFileIds, fileEmbed, insertEmbedAtCursor } from "@/lib/attachments";
import type { AttachmentDTO } from "@/lib/types";
import { AttachmentGallery } from "./AttachmentGallery";
import { AttachmentUploader } from "./AttachmentUploader";
import { TaskDescription } from "./TaskDescription";
import { useAttachmentUpload } from "./useAttachmentUpload";

/**
 * Описание и файлы в форме создания задачи.
 *
 * Задачи ещё нет, поэтому файлы уходят черновиками проекта и привязываются
 * к задаче при отправке формы — их id едут в скрытых полях `attachmentIds`.
 * Любой из них можно вставить в описание и сразу увидеть в предпросмотре.
 *
 * Текст и список файлов живут в родителе: форма пересобирается при смене
 * шаблона (key), и состояние внутри этого блока такую пересборку не
 * переживало бы — уже загруженные файлы потерялись бы вместе с ним.
 */
export function DescriptionComposer({
  projectId,
  description,
  onDescriptionChange,
  attachments,
  onAttachmentsChange,
  inputClassName,
}: {
  projectId: string;
  description: string;
  onDescriptionChange: (next: string) => void;
  attachments: AttachmentDTO[];
  onAttachmentsChange: (next: AttachmentDTO[]) => void;
  inputClassName: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const target = useMemo(() => ({ projectId }), [projectId]);
  const pasted = useAttachmentUpload(target, added);
  const insertedIds = embeddedFileIds(description);

  /** Загруженный файл добавляется к списку; в описание — по кнопке. */
  function added(attachment: AttachmentDTO) {
    onAttachmentsChange([...attachments, attachment]);
  }

  function insert(attachment: AttachmentDTO) {
    const area = textareaRef.current;
    const next = insertEmbedAtCursor(
      description,
      fileEmbed(attachment.id),
      area?.selectionStart ?? description.length
    );
    onDescriptionChange(next.text);
    requestAnimationFrame(() => {
      area?.focus();
      area?.setSelectionRange(next.cursor, next.cursor);
    });
  }

  return (
    <>
      <label className="mb-4 block">
        <span className="mb-1.5 block text-sm text-muted">
          Описание <span className="text-xs">· поддерживается markdown</span>
        </span>
        <textarea
          ref={textareaRef}
          name="description"
          rows={4}
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          onPaste={(e) => {
            // Картинка из буфера становится вложением задачи: в описании
            // хранится только текст, положить её больше некуда.
            const files = Array.from(e.clipboardData.files);
            if (files.length === 0) return;
            e.preventDefault();
            void pasted.upload(files);
          }}
          placeholder="Детали, контекст, критерии приёмки…"
          className={`${inputClassName} resize-none`}
        />
      </label>

      {description.trim() && (
        <details className="mb-4 rounded-lg border border-edge bg-surface-2/40 px-3 py-2">
          <summary className="cursor-pointer text-xs text-muted">
            Предпросмотр описания
          </summary>
          <div className="mt-2">
            <TaskDescription text={description} attachments={attachments} />
          </div>
        </details>
      )}

      <div className="mb-4">
        <span className="mb-1.5 block text-sm text-muted">
          Файлы{" "}
          <span className="text-xs">· можно вставить в описание</span>
        </span>
        <AttachmentUploader target={target} onUploaded={added} />
        {pasted.error && <p className="mt-2 text-sm text-danger-text">{pasted.error}</p>}
        {attachments.length > 0 && (
          <div className="mt-3">
            <AttachmentGallery
              attachments={attachments}
              insertedIds={insertedIds}
              onInsert={insert}
              onDeleted={(id) => {
                onAttachmentsChange(attachments.filter((a) => a.id !== id));
                // Вставку удалённого файла убираем из текста: иначе в
                // описании осталась бы строка про пропавшее вложение.
                onDescriptionChange(
                  description
                    .split(/\r?\n/)
                    .filter((line) => line.trim() !== fileEmbed(id))
                    .join("\n")
                );
              }}
            />
          </div>
        )}
        {attachments.map((a) => (
          <input key={a.id} type="hidden" name="attachmentIds" value={a.id} />
        ))}
      </div>
    </>
  );
}
