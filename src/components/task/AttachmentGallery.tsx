"use client";

import { useState, useTransition } from "react";
import { Dialog } from "@toimetdev/pathlogs-core";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { deleteAttachmentAction } from "@/lib/actions/tasks";
import { formatFileSize, isImageMime } from "@/lib/attachments";
import type { AttachmentDTO } from "@/lib/types";

/**
 * Список вложений плитками: у картинок — превью, у остальных файлов — значок
 * с именем. Клик по картинке открывает её целиком, не уводя со страницы.
 *
 * Превью грузится тем же адресом /api/files/…, что и скачивание: бакет
 * приватный, права проверяются на каждый запрос, поэтому отдельной
 * «публичной» миниатюры у файла нет.
 */
export function AttachmentGallery({
  attachments,
  onDeleted,
  onInsert,
  insertedIds = [],
  emptyHint,
}: {
  attachments: AttachmentDTO[];
  /** Вызывается после удаления — чтобы убрать плитку из списка на клиенте. */
  onDeleted?: (id: string) => void;
  /** Показывает кнопку «в описание»; без неё вставлять некуда. */
  onInsert?: (attachment: AttachmentDTO) => void;
  /** id файлов, уже вставленных в описание: кнопка у них выключена. */
  insertedIds?: string[];
  emptyHint?: string;
}) {
  const [viewing, setViewing] = useState<AttachmentDTO | null>(null);
  const [asking, setAsking] = useState<AttachmentDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove(attachment: AttachmentDTO) {
    startTransition(async () => {
      try {
        await deleteAttachmentAction(attachment.id);
        onDeleted?.(attachment.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось удалить файл");
      } finally {
        setAsking(null);
      }
    });
  }

  if (attachments.length === 0) {
    return emptyHint ? <p className="text-sm text-muted">{emptyHint}</p> : null;
  }

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {attachments.map((a) => {
          const inserted = insertedIds.includes(a.id);
          return (
            <li
              key={a.id}
              className="flex flex-col overflow-hidden rounded-xl border border-edge bg-surface-2/50"
            >
              {isImageMime(a.mime) ? (
                <button
                  type="button"
                  onClick={() => setViewing(a)}
                  className="group block h-28 w-full overflow-hidden bg-surface"
                  aria-label={`Открыть ${a.filename}`}
                >
                  {/* next/image здесь не годится: оптимизатор запрашивает
                      файл сам, без куки пользователя, и получает от
                      /api/files 403 — поэтому обычный img. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.url}
                    alt={a.filename}
                    className="h-28 w-full object-cover transition group-hover:scale-105"
                    loading="lazy"
                  />
                </button>
              ) : (
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-28 w-full items-center justify-center bg-surface text-muted transition hover:text-accent-hover"
                  aria-label={`Скачать ${a.filename}`}
                >
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5A3.375 3.375 0 0010.125 2.25H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </a>
              )}

              <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-2.5">
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  title={a.filename}
                  className="truncate text-sm font-medium hover:text-accent-hover"
                >
                  {a.filename}
                </a>
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
                  <span>{formatFileSize(a.size)}</span>
                  <span className="rounded bg-surface px-1.5 py-0.5">
                    {a.storage === "S3" ? "S3" : "локально"}
                  </span>
                  {!a.taskId && (
                    <span
                      className="rounded bg-surface px-1.5 py-0.5"
                      data-tip="Файл привяжется к задаче при её создании"
                    >
                      черновик
                    </span>
                  )}
                </div>
                <div className="mt-auto flex items-center gap-1">
                  {onInsert && (
                    <button
                      type="button"
                      onClick={() => onInsert(a)}
                      disabled={inserted}
                      data-tip={
                        inserted
                          ? "Файл уже вставлен в описание"
                          : "Вставить файл в описание"
                      }
                      className="rounded border border-edge px-1.5 py-0.5 text-[10px] text-muted transition hover:border-accent/60 hover:text-foreground disabled:opacity-40"
                    >
                      {inserted ? "в описании" : "в описание"}
                    </button>
                  )}
                  {a.canDelete && (
                    <button
                      type="button"
                      onClick={() => setAsking(a)}
                      disabled={pending}
                      data-tip="Удалить файл"
                      aria-label={`Удалить ${a.filename}`}
                      className="ml-auto rounded p-1 text-muted transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      <ConfirmDialog
        open={asking !== null}
        title="Удалить файл?"
        message={asking ? `«${asking.filename}» исчезнет и из хранилища.` : ""}
        confirmLabel="Удалить"
        tone="danger"
        pending={pending}
        onConfirm={() => asking && remove(asking)}
        onCancel={() => setAsking(null)}
      />

      <Dialog
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={viewing?.filename}
        size="xl"
      >
        {viewing && (
          <div className="flex flex-col items-center gap-3">
            {/* Обычный img — причина та же, что у миниатюры выше. */}
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
    </>
  );
}
