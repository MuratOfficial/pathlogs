"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import type { TaskStatus } from "@prisma/client";
import type { ColumnDTO, MemberDTO, TagDTO } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/labels";
import { describeRule, type BoardRuleLike } from "@/lib/boardRules";
import {
  createBoardRuleAction,
  deleteBoardRuleAction,
  toggleBoardRuleAction,
} from "@/lib/actions/rules";

const selectCls =
  "w-full rounded-lg border border-edge bg-surface-2 px-2.5 py-1.5 text-sm outline-none focus:border-accent";

/**
 * Автоматизации доски: «карточка попала в колонку → сделать с ней то-то».
 * Правила применяются при переносе карточки, а не по расписанию, — поэтому
 * результат виден сразу и его легко связать с причиной.
 */
export function BoardRulesDialog({
  projectId,
  columns,
  members,
  tags,
  rules,
}: {
  projectId: string;
  columns: ColumnDTO[];
  members: MemberDTO[];
  tags: TagDTO[];
  rules: BoardRuleLike[];
}) {
  const [open, setOpen] = useState(false);
  const [columnId, setColumnId] = useState(columns[0]?.id ?? "");
  const [status, setStatus] = useState<TaskStatus | "">("");
  const [userId, setUserId] = useState("");
  const [tagId, setTagId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const nameOfColumn = (id: string) => columns.find((c) => c.id === id)?.name ?? "колонка удалена";

  function add() {
    if (!status && !userId && !tagId) {
      setError("Выберите хотя бы одно действие");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await createBoardRuleAction(projectId, {
          columnId,
          setStatus: status || null,
          assignUserId: userId || null,
          addTagId: tagId || null,
        });
        setStatus("");
        setUserId("");
        setTagId("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось создать правило");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-tip="Автоматизации доски"
        className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-2 text-xs font-medium text-muted transition hover:bg-surface-2 hover:text-foreground"
      >
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
        <span className="hidden sm:inline">Правила</span>
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && setOpen(false)}
          >
            <div className="animate-pop-in max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-edge bg-surface p-6 shadow-2xl">
              <h2 className="mb-1 text-lg font-semibold">Правила доски</h2>
              <p className="mb-5 text-sm text-muted">
                Срабатывают в момент, когда карточку переносят в колонку — вручную или
                перетаскиванием.
              </p>

              <div className="mb-5 space-y-2">
                {rules.map((r) => (
                  <div
                    key={r.id}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
                      r.active ? "border-edge bg-surface-2/60" : "border-dashed border-edge opacity-60"
                    }`}
                  >
                    <span className="min-w-0 flex-1 text-sm">
                      {describeRule(r, {
                        column: nameOfColumn(r.columnId),
                        status: r.setStatus ? STATUS_LABELS[r.setStatus] : undefined,
                        user: members.find((m) => m.id === r.assignUserId)?.name,
                        tag: tags.find((t) => t.id === r.addTagId)?.name,
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() => startTransition(() => toggleBoardRuleAction(r.id))}
                      className="shrink-0 rounded-lg border border-edge px-2 py-1 text-xs text-muted transition hover:text-foreground"
                    >
                      {r.active ? "Выключить" : "Включить"}
                    </button>
                    <button
                      type="button"
                      data-tip="Удалить правило"
                      onClick={() => startTransition(() => deleteBoardRuleAction(r.id))}
                      className="shrink-0 text-muted/70 transition hover:text-red-400"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {rules.length === 0 && (
                  <p className="rounded-xl border border-dashed border-edge px-3 py-6 text-center text-sm text-muted">
                    Правил пока нет. Например: «карточка попала в „Готово“ → статус „Готово“».
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-edge p-4">
                <h3 className="mb-3 text-sm font-semibold">Новое правило</h3>

                <label className="mb-3 block">
                  <span className="mb-1 block text-xs text-muted">Когда карточка попадает в</span>
                  <select value={columnId} onChange={(e) => setColumnId(e.target.value)} className={selectCls}>
                    {columns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>

                <span className="mb-1 block text-xs text-muted">Сделать</span>
                <div className="mb-3 space-y-2">
                  <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus | "")} className={selectCls}>
                    <option value="">— статус не менять —</option>
                    {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
                      <option key={s} value={s}>
                        Статус: {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  <select value={userId} onChange={(e) => setUserId(e.target.value)} className={selectCls}>
                    <option value="">— исполнителя не назначать —</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        Назначить: {m.name}
                      </option>
                    ))}
                  </select>
                  {tags.length > 0 && (
                    <select value={tagId} onChange={(e) => setTagId(e.target.value)} className={selectCls}>
                      <option value="">— метку не вешать —</option>
                      {tags.map((t) => (
                        <option key={t.id} value={t.id}>
                          Метка: {t.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {error && <p className="mb-2 text-sm text-red-400">{error}</p>}

                <button
                  type="button"
                  onClick={add}
                  disabled={pending || !columnId}
                  className="w-full rounded-lg bg-accent py-2 text-sm font-semibold transition hover:bg-accent-hover disabled:opacity-50"
                >
                  {pending ? "Сохраняем…" : "Добавить правило"}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-4 w-full rounded-lg border border-edge py-2 text-sm text-muted transition hover:bg-surface-2 hover:text-foreground"
              >
                Закрыть
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
