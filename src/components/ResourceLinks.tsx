"use client";

import { useActionState, useState, useTransition } from "react";
import type { ResourceLinkDTO } from "@/lib/types";
import {
  addResourceLinkAction,
  deleteResourceLinkAction,
  updateResourceLinkAction,
} from "@/lib/actions/links";
import { linkHost } from "@/lib/url";
import { formatDate } from "@/lib/labels";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";

const inputCls =
  "w-full rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm outline-none transition focus:border-accent";

/**
 * Форма ссылки — общая для добавления и редактирования.
 * Обязателен только адрес: название и описание необязательны.
 */
function LinkForm({
  projectId,
  taskId,
  link,
  onDone,
  onCancel,
}: {
  projectId: string;
  taskId?: string;
  /** Задана — режим редактирования. */
  link?: ResourceLinkDTO;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    async (prev: { error?: string } | undefined, formData: FormData) => {
      const res = link
        ? await updateResourceLinkAction(prev, formData)
        : await addResourceLinkAction(prev, formData);
      if (!res.error) onDone();
      return res;
    },
    undefined
  );

  return (
    <form
      action={formAction}
      className="rounded-xl border border-edge bg-surface-2/50 p-4"
    >
      <input type="hidden" name="projectId" value={projectId} />
      {taskId && <input type="hidden" name="taskId" value={taskId} />}
      {link && <input type="hidden" name="id" value={link.id} />}

      <label className="mb-3 block">
        <span className="mb-1.5 block text-xs text-muted">Адрес *</span>
        <input
          name="url"
          required
          autoFocus
          defaultValue={link?.url ?? ""}
          placeholder="https://example.com/doc"
          className={inputCls}
        />
      </label>

      <label className="mb-3 block">
        <span className="mb-1.5 block text-xs text-muted">
          Название <span className="opacity-70">· необязательно</span>
        </span>
        <input
          name="title"
          maxLength={120}
          defaultValue={link?.title ?? ""}
          placeholder="Например: Макеты в Figma"
          className={inputCls}
        />
      </label>

      <label className="mb-4 block">
        <span className="mb-1.5 block text-xs text-muted">Описание</span>
        <textarea
          name="description"
          rows={2}
          maxLength={1000}
          defaultValue={link?.description ?? ""}
          placeholder="Что это за ссылка и зачем она нужна"
          className={`${inputCls} resize-y leading-relaxed`}
        />
      </label>

      {state?.error && (
        <p className="mb-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger-text">
          {state.error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-edge px-3 py-1.5 text-sm text-muted transition hover:bg-surface hover:text-foreground"
        >
          Отмена
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold transition hover:bg-accent-hover disabled:opacity-50"
        >
          {pending ? "Сохраняем…" : link ? "Сохранить" : "Добавить"}
        </button>
      </div>
    </form>
  );
}

function LinkRow({
  link,
  projectId,
  taskId,
}: {
  link: ResourceLinkDTO;
  projectId: string;
  taskId?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();

  if (editing) {
    return (
      <li>
        <LinkForm
          projectId={projectId}
          taskId={taskId}
          link={link}
          onDone={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li
      className={`group rounded-xl border border-edge bg-surface-2/40 p-3.5 transition hover:border-accent/40 ${
        pending ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-start gap-2.5">
        <Icon name="link" className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
        <div className="min-w-0 flex-1">
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block break-words text-sm font-semibold transition hover:text-accent-hover"
          >
            {link.title || linkHost(link.url)}
          </a>
          <p className="mt-0.5 break-all text-xs text-muted/80">{link.url}</p>
          {link.description && (
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted">
              {link.description}
            </p>
          )}
          <p className="mt-2 text-[11px] text-muted/70">
            {link.author.name} · {formatDate(link.createdAt)}
          </p>
        </div>
        {link.canEdit && (
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
            <button
              type="button"
              onClick={() => setEditing(true)}
              data-tip="Редактировать ссылку"
              aria-label="Редактировать ссылку"
              className="rounded p-1.5 text-muted transition hover:bg-surface hover:text-foreground"
            >
              <Icon name="pencil" className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setAsking(true)}
              data-tip="Удалить ссылку"
              aria-label="Удалить ссылку"
              className="rounded p-1.5 text-muted transition hover:bg-danger/10 hover:text-danger-text"
            >
              <Icon name="trash" className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={asking}
        title="Удалить ссылку?"
        message={link.title || link.url}
        confirmLabel="Удалить"
        pending={pending}
        onConfirm={() =>
          startTransition(async () => {
            await deleteResourceLinkAction(link.id);
            setAsking(false);
          })
        }
        onCancel={() => setAsking(false)}
      />
    </li>
  );
}

/**
 * Список полезных ссылок с формой добавления.
 * Используется и во вкладке проекта, и в блоке задачи (taskId).
 */
export function ResourceLinks({
  projectId,
  taskId,
  links,
  emptyHint,
}: {
  projectId: string;
  /** Задан — ссылки принадлежат задаче, иначе проекту. */
  taskId?: string;
  links: ResourceLinkDTO[];
  emptyHint?: string;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div>
      {adding ? (
        <div className="mb-4">
          <LinkForm
            projectId={projectId}
            taskId={taskId}
            onDone={() => setAdding(false)}
            onCancel={() => setAdding(false)}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mb-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-edge py-2.5 text-sm font-medium text-muted transition hover:border-accent/50 hover:bg-surface-2/50 hover:text-foreground"
        >
          <Icon name="plus" className="h-4 w-4" />
          Добавить ссылку
        </button>
      )}

      {links.length === 0 ? (
        <p className="text-sm text-muted">
          {emptyHint ?? "Ссылок пока нет — добавьте документацию, макеты или дашборды."}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {links.map((l) => (
            <LinkRow key={l.id} link={l} projectId={projectId} taskId={taskId} />
          ))}
        </ul>
      )}
    </div>
  );
}
