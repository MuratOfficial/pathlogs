"use client";

import { useState } from "react";
import { buildCommentThreads } from "@/lib/comments";
import { deleteCommentAction } from "@/lib/actions/tasks";
import { formatDateTime, initials } from "@/lib/labels";
import type { MemberDTO } from "@/lib/types";
import { Markdown } from "../Markdown";
import { CommentForm } from "./CommentForm";
import { ConfirmActionButton } from "./ConfirmActionButton";

export interface CommentDTO {
  id: string;
  parentId: string | null;
  content: string;
  createdAt: string;
  authorId: string;
  authorName: string;
}

function CommentBody({
  comment,
  canDelete,
  memberNames,
}: {
  comment: CommentDTO;
  canDelete: boolean;
  memberNames: string[];
}) {
  return (
    <>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/25 text-[9px] font-bold text-accent-hover">
          {initials(comment.authorName)}
        </span>
        <span className="text-sm font-semibold">{comment.authorName}</span>
        <span className="ml-auto text-xs text-muted">{formatDateTime(comment.createdAt)}</span>
        {canDelete && (
          <ConfirmActionButton
            action={deleteCommentAction.bind(null, comment.id)}
            confirmText="Удалить комментарий? Ответы в ветке удалятся вместе с ним."
            small
          />
        )}
      </div>
      <Markdown text={comment.content} mentions={memberNames} />
    </>
  );
}

/**
 * Обсуждение задачи ветками: у каждого комментария есть «Ответить», ответы
 * висят под своим корнем. Вложенность намеренно одноуровневая — ответ на
 * ответ попадает в ту же ветку (см. buildCommentThreads).
 */
export function CommentThreads({
  taskId,
  comments,
  members,
  currentUserId,
  canModerate,
}: {
  taskId: string;
  comments: CommentDTO[];
  members: MemberDTO[];
  currentUserId: string;
  /** Админ может удалять чужие комментарии. */
  canModerate: boolean;
}) {
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const threads = buildCommentThreads(comments);
  const memberNames = members.map((m) => m.name);
  const mayDelete = (c: CommentDTO) => c.authorId === currentUserId || canModerate;

  if (comments.length === 0) {
    return <p className="mb-4 text-sm text-muted">Комментариев нет — начните обсуждение.</p>;
  }

  return (
    <div className="mb-4 space-y-3">
      {threads.map(({ root, replies }) => (
        <article key={root.id} className="rounded-xl border border-edge bg-surface-2/50 p-4">
          <CommentBody comment={root} canDelete={mayDelete(root)} memberNames={memberNames} />

          {replies.length > 0 && (
            // Полоса слева вместо отступа-лесенки: ветка читается и на телефоне
            <div className="mt-3 space-y-3 border-l-2 border-edge pl-3">
              {replies.map((r) => (
                <div key={r.id}>
                  <CommentBody comment={r} canDelete={mayDelete(r)} memberNames={memberNames} />
                </div>
              ))}
            </div>
          )}

          {replyTo === root.id ? (
            <div className="mt-3 border-l-2 border-accent/50 pl-3">
              <CommentForm
                taskId={taskId}
                members={members}
                parentId={root.id}
                autoFocus
                compact
                placeholder="Ответить в ветке…"
                onDone={() => setReplyTo(null)}
              />
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="mt-1 text-xs text-muted transition hover:text-foreground"
              >
                Отмена
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setReplyTo(root.id)}
              className="mt-3 text-xs font-medium text-muted transition hover:text-accent-hover"
            >
              Ответить{replies.length > 0 ? ` · ${replies.length}` : ""}
            </button>
          )}
        </article>
      ))}
    </div>
  );
}
