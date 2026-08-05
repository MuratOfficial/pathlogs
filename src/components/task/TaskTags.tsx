"use client";

import { useState, useTransition } from "react";
import type { TagDTO } from "@/lib/types";
import { createTagAction, deleteTagAction, setTaskTagsAction } from "@/lib/actions/tags";
import { BOARD_PALETTE } from "@/lib/labels";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TagChip } from "@/components/TaskBadges";

/**
 * Панель меток задачи: назначение из меток проекта + создание новых.
 * Удалять метку из проекта целиком может только менеджер (canManage).
 */
export function TaskTags({
  taskId,
  projectId,
  tags,
  projectTags: initialProjectTags,
  canManage,
}: {
  taskId: string;
  projectId: string;
  /** Метки, назначенные задаче. */
  tags: TagDTO[];
  /** Все метки проекта. */
  projectTags: TagDTO[];
  canManage: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(tags.map((t) => t.id));
  const [projectTags, setProjectTags] = useState(initialProjectTags);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(BOARD_PALETTE[2]);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<TagDTO | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(tagId: string) {
    const next = selected.includes(tagId)
      ? selected.filter((id) => id !== tagId)
      : [...selected, tagId];
    setSelected(next);
    startTransition(() => setTaskTagsAction(taskId, next));
  }

  function create() {
    const clean = name.trim();
    if (!clean) return;
    setError(null);
    startTransition(async () => {
      const res = await createTagAction(projectId, clean, color);
      if (res.error || !res.tag) {
        setError(res.error ?? "Не удалось создать метку");
        return;
      }
      const tag = res.tag;
      setProjectTags((prev) =>
        prev.some((t) => t.id === tag.id) ? prev : [...prev, tag]
      );
      setName("");
      setAdding(false);
      if (!selected.includes(tag.id)) {
        const next = [...selected, tag.id];
        setSelected(next);
        await setTaskTagsAction(taskId, next);
      }
    });
  }

  function removeFromProject(tag: TagDTO) {
    startTransition(async () => {
      await deleteTagAction(tag.id);
      setProjectTags((prev) => prev.filter((t) => t.id !== tag.id));
      setSelected((prev) => prev.filter((id) => id !== tag.id));
      setRemoving(null);
    });
  }

  return (
    <section className={`rounded-2xl border border-edge bg-surface p-5 ${pending ? "opacity-70" : ""}`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Метки</h2>
        <button
          type="button"
          onClick={() => {
            setAdding((v) => !v);
            setError(null);
          }}
          data-tip="Создать новую метку"
          className="rounded-lg px-1.5 py-0.5 text-lg leading-none text-muted transition hover:bg-surface-2 hover:text-foreground"
        >
          {adding ? "×" : "+"}
        </button>
      </div>

      {adding && (
        <div className="mb-3 rounded-xl border border-edge bg-surface-2/60 p-3">
          <input
            autoFocus
            value={name}
            maxLength={30}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                create();
              }
              if (e.key === "Escape") setAdding(false);
            }}
            placeholder="Название метки"
            className="w-full rounded-lg border border-edge bg-surface px-2.5 py-1.5 text-sm outline-none transition focus:border-accent"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {BOARD_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Цвет ${c}`}
                className={`h-5 w-5 rounded-full border transition hover:scale-110 ${
                  color === c ? "border-foreground" : "border-edge"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          <button
            type="button"
            disabled={!name.trim() || pending}
            onClick={create}
            className="mt-2.5 w-full rounded-lg bg-accent py-1.5 text-xs font-semibold transition hover:bg-accent-hover disabled:opacity-50"
          >
            Создать и назначить
          </button>
        </div>
      )}

      {projectTags.length === 0 && !adding ? (
        <p className="text-xs text-muted">
          Меток пока нет. Нажмите «+», чтобы создать первую.
        </p>
      ) : (
        <ul className="max-h-56 space-y-1 overflow-y-auto">
          {projectTags.map((t) => {
            const on = selected.includes(t.id);
            return (
              <li key={t.id} className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => toggle(t.id)}
                  aria-pressed={on}
                  className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left transition ${
                    on ? "bg-surface-2" : "hover:bg-surface-2/60"
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                      on ? "border-transparent" : "border-edge"
                    }`}
                    style={on ? { backgroundColor: t.color } : undefined}
                  >
                    {on && (
                      <svg className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 10.5l3.5 3.5L15 6.5" />
                      </svg>
                    )}
                  </span>
                  <TagChip tag={t} />
                </button>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setRemoving(t)}
                    data-tip="Удалить метку из проекта"
                    aria-label={`Удалить метку ${t.name}`}
                    className="shrink-0 rounded p-1 text-muted transition hover:bg-red-500/10 hover:text-red-400"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={removing !== null}
        title={`Удалить метку «${removing?.name ?? ""}»?`}
        message="Метка исчезнет из проекта и со всех задач, где она проставлена."
        confirmLabel="Удалить"
        pending={pending}
        onConfirm={() => removing && removeFromProject(removing)}
        onCancel={() => setRemoving(null)}
      />
    </section>
  );
}
