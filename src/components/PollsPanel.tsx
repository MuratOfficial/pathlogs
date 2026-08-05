"use client";

import { useActionState, useState, useTransition } from "react";
import type { PollDTO } from "@/lib/types";
import {
  createPollAction,
  deletePollAction,
  togglePollClosedAction,
  votePollAction,
} from "@/lib/actions/polls";
import { formatDateTime, initials, plural } from "@/lib/labels";
import { ConfirmDialog } from "@/components/ConfirmDialog";

function NewPollForm({
  projectId,
  onDone,
}: {
  projectId: string;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    async (prev: { error?: string } | undefined, formData: FormData) => {
      const res = await createPollAction(prev, formData);
      if (!res.error) onDone();
      return res;
    },
    undefined
  );

  const inputCls =
    "w-full rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm outline-none transition focus:border-accent";

  return (
    <form
      action={formAction}
      className="animate-pop-in mb-5 rounded-2xl border border-edge bg-surface p-5"
    >
      <input type="hidden" name="projectId" value={projectId} />
      <h3 className="mb-4 text-sm font-semibold">Новый опрос</h3>

      <label className="mb-4 block">
        <span className="mb-1.5 block text-sm text-muted">Вопрос *</span>
        <input
          name="question"
          required
          minLength={3}
          maxLength={300}
          placeholder="Например: какой стек берём для нового сервиса?"
          className={inputCls}
        />
      </label>

      <label className="mb-4 block">
        <span className="mb-1.5 block text-sm text-muted">Пояснение</span>
        <textarea
          name="description"
          rows={2}
          placeholder="Контекст, сроки, на что смотреть при выборе…"
          className={`${inputCls} resize-y`}
        />
      </label>

      <label className="mb-4 block">
        <span className="mb-1.5 block text-sm text-muted">
          Варианты ответа * <span className="text-xs">· по варианту на строку, минимум два</span>
        </span>
        <textarea
          name="options"
          rows={4}
          required
          placeholder={"Вариант А\nВариант Б\nВариант В"}
          className={`${inputCls} resize-y`}
        />
      </label>

      <div className="mb-5 flex flex-wrap gap-5">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" name="multiple" className="accent-indigo-500" />
          Можно выбрать несколько
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" name="anonymous" className="accent-indigo-500" />
          Анонимно (не показывать, кто как проголосовал)
        </label>
      </div>

      {state?.error && (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {state.error}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg border border-edge px-4 py-2 text-sm text-muted transition hover:bg-surface-2"
        >
          Отмена
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold transition hover:bg-accent-hover disabled:opacity-50"
        >
          {pending ? "Создаём…" : "Создать опрос"}
        </button>
      </div>
    </form>
  );
}

function PollCard({ poll }: { poll: PollDTO }) {
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<"delete" | "close" | null>(null);
  // Оптимистичный выбор: сервер пересчитает результаты после ревалидации
  const [chosen, setChosen] = useState<string[]>(
    poll.options.filter((o) => o.chosenByMe).map((o) => o.id)
  );
  const [showVoters, setShowVoters] = useState(false);

  const total = poll.options.reduce((s, o) => s + o.votes, 0);

  function pick(optionId: string) {
    if (poll.closed || pending) return;
    const next = poll.multiple
      ? chosen.includes(optionId)
        ? chosen.filter((id) => id !== optionId)
        : [...chosen, optionId]
      : chosen.includes(optionId)
        ? []
        : [optionId];
    setChosen(next);
    startTransition(() => votePollAction(poll.id, next));
  }

  return (
    <article
      className={`rounded-2xl border border-edge bg-surface p-5 transition ${
        pending ? "opacity-70" : ""
      } ${poll.closed ? "opacity-80" : ""}`}
    >
      <div className="mb-1 flex items-start gap-3">
        <h3 className="min-w-0 flex-1 text-base font-semibold leading-snug">
          {poll.question}
        </h3>
        {poll.closed && (
          <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-muted">
            Завершён
          </span>
        )}
        {poll.canManage && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => (poll.closed ? startTransition(() => togglePollClosedAction(poll.id)) : setConfirm("close"))}
              disabled={pending}
              data-tip={poll.closed ? "Открыть заново" : "Завершить опрос"}
              aria-label={poll.closed ? "Открыть заново" : "Завершить опрос"}
              className="rounded p-1.5 text-muted transition hover:bg-surface-2 hover:text-foreground disabled:opacity-50"
            >
              {poll.closed ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              )}
            </button>
            <button
              type="button"
              onClick={() => setConfirm("delete")}
              disabled={pending}
              data-tip="Удалить опрос"
              aria-label="Удалить опрос"
              className="rounded p-1.5 text-muted transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {poll.description && (
        <p className="mb-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted">
          {poll.description}
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/25 text-[9px] font-bold text-accent-hover">
            {initials(poll.author.name)}
          </span>
          {poll.author.name}
        </span>
        <span>·</span>
        <span>{formatDateTime(poll.createdAt)}</span>
        <span>·</span>
        <span>
          {poll.voterCount}{" "}
          {plural(poll.voterCount, "участник", "участника", "участников")}{" "}
          {plural(poll.voterCount, "проголосовал", "проголосовали", "проголосовало")}
        </span>
        {poll.multiple && (
          <span className="rounded-full bg-surface-2 px-2 py-0.5">несколько вариантов</span>
        )}
        {poll.anonymous && (
          <span className="rounded-full bg-surface-2 px-2 py-0.5">анонимно</span>
        )}
      </div>

      <ul className="space-y-2">
        {poll.options.map((o) => {
          const on = chosen.includes(o.id);
          const pct = total > 0 ? Math.round((o.votes / total) * 100) : 0;
          return (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => pick(o.id)}
                disabled={poll.closed || pending}
                aria-pressed={on}
                className={`relative w-full overflow-hidden rounded-xl border px-3.5 py-2.5 text-left transition ${
                  on ? "border-accent/70 bg-accent/5" : "border-edge hover:border-accent/40"
                } ${poll.closed ? "cursor-default" : "cursor-pointer"}`}
              >
                {/* Полоса результата — фон под содержимым */}
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 bg-accent/15 transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
                <span className="relative flex items-center gap-2.5">
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center border transition ${
                      poll.multiple ? "rounded" : "rounded-full"
                    } ${on ? "border-accent bg-accent" : "border-edge"}`}
                  >
                    {on &&
                      (poll.multiple ? (
                        <svg className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 10.5l3.5 3.5L15 6.5" />
                        </svg>
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      ))}
                  </span>
                  <span className="min-w-0 flex-1 break-words text-sm font-medium">
                    {o.text}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted">
                    {o.votes} · {pct}%
                  </span>
                </span>
                {!poll.anonymous && showVoters && o.voters.length > 0 && (
                  <span className="relative mt-1.5 flex flex-wrap gap-1 pl-6">
                    {o.voters.map((v) => (
                      <span
                        key={v.id}
                        className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-muted"
                      >
                        {v.name}
                      </span>
                    ))}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
        {!poll.anonymous && poll.voterCount > 0 && (
          <button
            type="button"
            onClick={() => setShowVoters((v) => !v)}
            className="text-muted transition hover:text-foreground"
          >
            {showVoters ? "Скрыть, кто голосовал" : "Показать, кто голосовал"}
          </button>
        )}
        {!poll.closed && chosen.length > 0 && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setChosen([]);
              startTransition(() => votePollAction(poll.id, []));
            }}
            className="text-muted transition hover:text-red-400 disabled:opacity-50"
          >
            Отозвать голос
          </button>
        )}
        {poll.closed && (
          <span className="text-muted">Опрос завершён — голосование закрыто</span>
        )}
      </div>

      <ConfirmDialog
        open={confirm === "delete"}
        title="Удалить опрос?"
        message="Опрос и все отданные за него голоса будут удалены безвозвратно."
        confirmLabel="Удалить"
        pending={pending}
        onConfirm={() => startTransition(() => deletePollAction(poll.id))}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "close"}
        title="Завершить опрос?"
        message="Голосование закроется. Открыть его заново вы сможете в любой момент."
        confirmLabel="Завершить"
        tone="accent"
        pending={pending}
        onConfirm={() =>
          startTransition(async () => {
            await togglePollClosedAction(poll.id);
            setConfirm(null);
          })
        }
        onCancel={() => setConfirm(null)}
      />
    </article>
  );
}

/** Вкладка «Опрос»: список опросов проекта, создание и голосование. */
export function PollsPanel({
  projectId,
  polls,
}: {
  projectId: string;
  polls: PollDTO[];
}) {
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<"open" | "closed">("open");

  const open = polls.filter((p) => !p.closed);
  const closed = polls.filter((p) => p.closed);
  const shown = tab === "open" ? open : closed;

  return (
    <div className="h-full overflow-y-auto pb-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl border border-edge bg-surface p-1">
          {(
            [
              ["open", `Активные · ${open.length}`],
              ["closed", `Завершённые · ${closed.length}`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
                tab === id
                  ? "bg-accent text-white"
                  : "text-muted hover:bg-surface-2 hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold transition hover:bg-accent-hover"
          >
            + Новый опрос
          </button>
        )}
      </div>

      {creating && (
        <NewPollForm projectId={projectId} onDone={() => setCreating(false)} />
      )}

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-edge bg-surface/40 px-6 py-16 text-center">
          <p className="text-sm font-medium">
            {tab === "open" ? "Активных опросов нет" : "Завершённых опросов нет"}
          </p>
          <p className="mt-1.5 text-sm text-muted">
            Опрос может создать любой участник проекта — спросите команду, что думает.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {shown.map((p) => (
            <PollCard key={p.id} poll={p} />
          ))}
        </div>
      )}
    </div>
  );
}
