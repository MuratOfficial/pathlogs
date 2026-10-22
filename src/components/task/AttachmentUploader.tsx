"use client";

import { useRef, useState } from "react";
import { formatFileSize, MAX_ATTACHMENT_SIZE } from "@/lib/attachments";
import type { AttachmentDTO } from "@/lib/types";
import { useAttachmentUpload, type UploadTarget } from "./useAttachmentUpload";

/**
 * Зона загрузки файлов: клик, перетаскивание и вставка из буфера.
 *
 * Вставка слушается на самой зоне, а не на документе: на странице задачи есть
 * и поля ввода, и редактор описания — перехват Ctrl+V глобально отбирал бы
 * картинку у того, кто её ждёт.
 */
export function AttachmentUploader({
  target,
  onUploaded,
  compact = false,
}: {
  target: UploadTarget;
  onUploaded: (attachment: AttachmentDTO) => void;
  /** Узкая строка вместо большой зоны — для редактора описания. */
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const { busy, error, upload } = useAttachmentUpload(target, onUploaded);

  return (
    <div>
      {/* Фокусируемый div, а не <label>: событие вставки приходит только
          элементу в фокусе, а разметка ярлыка фокус не держит. */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Прикрепить файлы"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void upload(e.dataTransfer.files);
        }}
        onPaste={(e) => {
          const files = Array.from(e.clipboardData.files);
          if (files.length === 0) return;
          e.preventDefault();
          void upload(files);
        }}
        className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed text-sm transition outline-none focus-visible:border-accent ${
          compact ? "px-3 py-2" : "px-4 py-5"
        } ${
          dragging
            ? "border-accent bg-accent/10 text-foreground"
            : "border-edge text-muted hover:border-accent/60 hover:text-foreground"
        } ${busy ? "pointer-events-none opacity-50" : ""}`}
      >
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <span className="text-center">
          {busy
            ? "Загружаем…"
            : compact
              ? "Прикрепить файл или вставить картинку"
              : `Нажмите, перетащите или вставьте файлы (до ${formatFileSize(MAX_ATTACHMENT_SIZE)})`}
        </span>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            void upload(e.target.files);
            // Поле чистим, иначе повторный выбор того же файла не даст change
            e.target.value = "";
          }}
        />
      </div>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
