"use client";

import { useCallback, useState } from "react";
import { MAX_ATTACHMENT_SIZE, formatFileSize } from "@/lib/attachments";
import type { AttachmentDTO } from "@/lib/types";

/**
 * Куда уходит файл: во вложения существующей задачи (taskId) или черновиком
 * проекта, если задачи ещё нет — так работает форма создания (projectId).
 */
export type UploadTarget = { taskId: string } | { projectId: string };

/**
 * Загрузка файлов в /api/upload — общая для зоны перетаскивания, вставки из
 * буфера и кнопки «прикрепить». Файлы идут по одному: так понятно, какой
 * именно не прошёл, и первый же отказ не уносит с собой остальные.
 */
export function useAttachmentUpload(
  target: UploadTarget,
  onUploaded: (attachment: AttachmentDTO) => void
) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (files: FileList | File[] | null) => {
      const list = files ? Array.from(files) : [];
      if (list.length === 0) return;
      setBusy(true);
      setError(null);
      const failures: string[] = [];
      try {
        for (const file of list) {
          // Размер проверяем и здесь: иначе 25-мегабайтный предел выяснялся бы
          // только после того, как файл целиком уедет на сервер.
          if (file.size > MAX_ATTACHMENT_SIZE) {
            failures.push(
              `${file.name} — ${formatFileSize(file.size)}, больше ${formatFileSize(MAX_ATTACHMENT_SIZE)}`
            );
            continue;
          }
          const fd = new FormData();
          fd.append("file", file);
          if ("taskId" in target) fd.append("taskId", target.taskId);
          else fd.append("projectId", target.projectId);

          const res = await fetch("/api/upload", { method: "POST", body: fd });
          if (!res.ok) {
            const data = await res.json().catch(() => null);
            failures.push(`${file.name} — ${data?.error ?? `ошибка ${res.status}`}`);
            continue;
          }
          const data = (await res.json()) as { attachment: AttachmentDTO };
          onUploaded(data.attachment);
        }
        if (failures.length > 0) setError(failures.join("; "));
      } catch {
        setError("Не удалось загрузить файл — проверьте соединение");
      } finally {
        setBusy(false);
      }
    },
    [target, onUploaded]
  );

  return { busy, error, setError, upload };
}
