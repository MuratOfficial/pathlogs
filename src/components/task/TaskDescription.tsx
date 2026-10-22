"use client";

import { useState } from "react";
import { Dialog, Markdown } from "@toimetdev/pathlogs-core";
import { formatFileSize, isImageMime, splitDescription } from "@/lib/attachments";
import type { AttachmentDTO } from "@/lib/types";

/**
 * Описание задачи: markdown плюс вставленные файлы.
 *
 * Вставка в тексте — только id (`[[file:…]]`), а сам файл берётся из вложений
 * задачи, переданных сюда. Поэтому в описании не может появиться картинка с
 * чужого адреса: нечего приложить — нечего и показать.
 */
export function TaskDescription({
  text,
  attachments,
  className,
  emptyHint,
}: {
  text: string;
  attachments: AttachmentDTO[];
  className?: string;
  /** Что показать, когда описания нет. */
  emptyHint?: string;
}) {
  const [viewing, setViewing] = useState<AttachmentDTO | null>(null);
  const segments = splitDescription(text);

  if (segments.length === 0) {
    return emptyHint ? <p className="text-sm text-muted">{emptyHint}</p> : null;
  }

  const byId = new Map(attachments.map((a) => [a.id, a]));

  return (
    <div className={className}>
      {segments.map((segment, i) => {
        if (segment.kind === "text") {
          return <Markdown key={i} text={segment.text} />;
        }
        const file = byId.get(segment.id);
        if (!file) {
          return (
            <p key={i} className="my-2 text-sm text-muted italic">
              Вложение удалено
            </p>
          );
        }
        return (
          <figure key={i} className="my-3">
            {isImageMime(file.mime) ? (
              <button
                type="button"
                onClick={() => setViewing(file)}
                className="block max-w-full overflow-hidden rounded-xl border border-edge bg-surface-2/50 transition hover:border-accent/60"
                aria-label={`Открыть ${file.filename}`}
              >
                {/* next/image не подходит: оптимизатор ходит за файлом сам,
                    без куки пользователя, и получает от /api/files 403 —
                    поэтому обычный img. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={file.url}
                  alt={file.filename}
                  className="max-h-80 w-auto max-w-full object-contain"
                  loading="lazy"
                />
              </button>
            ) : (
              <a
                href={file.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex max-w-full items-center gap-2 rounded-xl border border-edge bg-surface-2/50 px-3 py-2 text-sm transition hover:border-accent/60"
              >
                <svg className="h-4 w-4 shrink-0 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                </svg>
                <span className="truncate">{file.filename}</span>
                <span className="shrink-0 text-xs text-muted">
                  {formatFileSize(file.size)}
                </span>
              </a>
            )}
            <figcaption className="mt-1 text-xs text-muted">
              {file.filename} · {formatFileSize(file.size)}
            </figcaption>
          </figure>
        );
      })}

      <Dialog
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={viewing?.filename}
        size="xl"
      >
        {viewing && (
          <div className="flex flex-col items-center gap-3">
            {/* Обычный img — причина та же, что у картинки выше. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={viewing.url}
              alt={viewing.filename}
              className="max-h-[70vh] w-auto max-w-full rounded-lg"
            />
            <a
              href={viewing.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-muted transition hover:text-foreground"
            >
              Открыть в новой вкладке · {formatFileSize(viewing.size)}
            </a>
          </div>
        )}
      </Dialog>
    </div>
  );
}
