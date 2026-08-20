"use client";

import { useState, useTransition } from "react";
import type { Priority, TaskStatus, TaskType } from "@prisma/client";
import type { MemberDTO, TagDTO } from "@/lib/types";
import { PRIORITY_LABELS, STATUS_LABELS, TYPE_LABELS } from "@/lib/labels";
import { bulkDeleteTasksAction, bulkUpdateTasksAction } from "@/lib/actions/tasks";
import { ConfirmDialog } from "./ConfirmDialog";

const selectCls =
  "rounded-lg border border-edge bg-surface-2 px-2.5 py-1.5 text-sm outline-none focus:border-accent";

/**
 * Панель массовых действий: появляется, когда выбрана хотя бы одна задача.
 * Каждый селект — отдельное действие: выбрал значение, оно сразу применилось
 * ко всем выбранным. Это надёжнее «формы с кнопкой Применить», в которой легко
 * забыть, что именно ты поменял в пачке из тридцати задач.
 */
export function BulkActionBar({
  selectedIds,
  members,
  projectTags,
  onDone,
  onClear,
}: {
  selectedIds: string[];
  members: MemberDTO[];
  projectTags: TagDTO[];
  /** Действие выполнено — родитель снимает выбор и ждёт обновления данных. */
  onDone: (result: string) => void;
  onClear: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const count = selectedIds.length;

  function run(label: string, fn: () => Promise<{ updated?: number; deleted?: number; skipped: number }>) {
    startTransition(async () => {
      const res = await fn();
      const done = res.updated ?? res.deleted ?? 0;
      onDone(
        res.skipped > 0
          ? `${label}: ${done}, пропущено без прав: ${res.skipped}`
          : `${label}: ${done}`
      );
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-accent/40 bg-accent/10 px-4 py-2.5">
      <span className="text-sm font-semibold">Выбрано: {count}</span>

      <select
        value=""
        disabled={pending}
        onChange={(e) => {
          const v = e.target.value as TaskStatus;
          if (v) run("Статус изменён", () => bulkUpdateTasksAction(selectedIds, { status: v }));
        }}
        className={selectCls}
      >
        <option value="">Статус…</option>
        {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>

      <select
        value=""
        disabled={pending}
        onChange={(e) => {
          const v = e.target.value as Priority;
          if (v) run("Приоритет изменён", () => bulkUpdateTasksAction(selectedIds, { priority: v }));
        }}
        className={selectCls}
      >
        <option value="">Приоритет…</option>
        {(Object.keys(PRIORITY_LABELS) as Priority[]).map((p) => (
          <option key={p} value={p}>
            {PRIORITY_LABELS[p]}
          </option>
        ))}
      </select>

      <select
        value=""
        disabled={pending}
        onChange={(e) => {
          const v = e.target.value as TaskType;
          if (v) run("Тип изменён", () => bulkUpdateTasksAction(selectedIds, { type: v }));
        }}
        className={selectCls}
      >
        <option value="">Тип…</option>
        {(Object.keys(TYPE_LABELS) as TaskType[]).map((t) => (
          <option key={t} value={t}>
            {TYPE_LABELS[t]}
          </option>
        ))}
      </select>

      <select
        value=""
        disabled={pending}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) return;
          // «Снять всех» отличается от «назначить» только пустым списком
          const ids = v === "NONE" ? [] : [v];
          run("Исполнитель назначен", () =>
            bulkUpdateTasksAction(selectedIds, { assigneeIds: ids })
          );
        }}
        className={selectCls}
      >
        <option value="">Исполнитель…</option>
        <option value="NONE">Снять всех</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>

      {projectTags.length > 0 && (
        <select
          value=""
          disabled={pending}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return;
            const [op, id] = v.split(":");
            run(op === "add" ? "Метка добавлена" : "Метка снята", () =>
              bulkUpdateTasksAction(
                selectedIds,
                op === "add" ? { addTagId: id } : { removeTagId: id }
              )
            );
          }}
          className={selectCls}
        >
          <option value="">Метка…</option>
          <optgroup label="Добавить">
            {projectTags.map((t) => (
              <option key={`add-${t.id}`} value={`add:${t.id}`}>
                {t.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Снять">
            {projectTags.map((t) => (
              <option key={`del-${t.id}`} value={`del:${t.id}`}>
                {t.name}
              </option>
            ))}
          </optgroup>
        </select>
      )}

      <button
        type="button"
        disabled={pending}
        onClick={() => setConfirmDelete(true)}
        className="rounded-lg border border-red-500/40 px-3 py-1.5 text-sm text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
      >
        Удалить
      </button>

      <button
        type="button"
        onClick={onClear}
        className="ml-auto rounded-lg border border-edge px-3 py-1.5 text-sm text-muted transition hover:bg-surface-2 hover:text-foreground"
      >
        Снять выбор
      </button>

      {pending && <span className="text-xs text-muted">Применяем…</span>}

      <ConfirmDialog
        open={confirmDelete}
        title={`Удалить ${count} задач?`}
        message="Вместе с задачами удалятся их патч-логи, комментарии и вложения. Подзадачи станут корневыми. Действие необратимо."
        confirmLabel="Удалить"
        tone="danger"
        onConfirm={() => {
          setConfirmDelete(false);
          run("Удалено", () => bulkDeleteTasksAction(selectedIds));
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
