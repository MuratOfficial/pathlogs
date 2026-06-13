"use client";

import { useActionState, useEffect, useRef } from "react";
import { addCommentAction } from "@/lib/actions/tasks";
import { MentionTextarea } from "./MentionTextarea";
import type { MemberDTO } from "@/lib/types";

export function CommentForm({
  taskId,
  members,
}: {
  taskId: string;
  members: MemberDTO[];
}) {
  const [state, formAction, pending] = useActionState(addCommentAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && !state.error) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="taskId" value={taskId} />
      <MentionTextarea
        name="content"
        members={members}
        rows={2}
        placeholder="Написать комментарий… (markdown, @ — упомянуть участника)"
        className="w-full resize-y rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
      />
      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-end rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold transition hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Отправляем…" : "Отправить"}
      </button>
    </form>
  );
}
