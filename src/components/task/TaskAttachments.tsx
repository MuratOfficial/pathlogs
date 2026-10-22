"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AttachmentDTO } from "@/lib/types";
import { AttachmentGallery } from "./AttachmentGallery";
import { AttachmentUploader } from "./AttachmentUploader";

/**
 * Блок «Файлы» на карточке задачи: загрузка и плитки с превью.
 *
 * Только что загруженный файл показываем сразу из ответа загрузки, не дожидаясь
 * refresh(): страница серверная, и перерисовка приходит с задержкой. Когда она
 * приходит, тот же файл уже есть в серверном списке — поэтому локальные
 * дубликаты отбрасываются по id.
 */
export function TaskAttachments({
  taskId,
  attachments,
}: {
  taskId: string;
  attachments: AttachmentDTO[];
}) {
  const router = useRouter();
  const [fresh, setFresh] = useState<AttachmentDTO[]>([]);
  const target = useMemo(() => ({ taskId }), [taskId]);

  const serverIds = new Set(attachments.map((a) => a.id));
  const list = [...fresh.filter((a) => !serverIds.has(a.id)), ...attachments];

  return (
    <div className="space-y-4">
      <AttachmentUploader
        target={target}
        onUploaded={(a) => {
          setFresh((prev) => [a, ...prev]);
          router.refresh();
        }}
      />
      <AttachmentGallery
        attachments={list}
        onDeleted={(id) => {
          setFresh((prev) => prev.filter((a) => a.id !== id));
          router.refresh();
        }}
      />
    </div>
  );
}
