"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { SlashTextarea, type SlashCommand } from "@toimetdev/pathlogs-core";
import { addPatchLogAction } from "@/lib/actions/tasks";

/**
 * Заготовки, которые вставляются по «/» прямо в текст записи.
 *
 * Патч-лог пишут в конце работы, когда подробности уже выветрились, — и
 * пустое поле обычно превращается в строчку «пофиксил». Список заголовков
 * задаёт форму рассказа, ничего не требуя: любой блок можно стереть.
 */
const TEMPLATES: (SlashCommand & { insert: string })[] = [
  {
    id: "full",
    label: "Полный шаблон",
    hint: "что, как, как проверить",
    keywords: "все всё структура",
    insert:
      "**Что сделано**\n\n\n**Как сделано**\n\n\n**Как проверить**\n1. \n\n**Побочные эффекты**\n— нет\n",
  },
  {
    id: "what",
    label: "Что сделано",
    hint: "блок с описанием",
    keywords: "сделано описание",
    insert: "**Что сделано**\n\n",
  },
  {
    id: "how",
    label: "Как проверить",
    hint: "шаги проверки",
    keywords: "проверить тест qa шаги",
    insert: "**Как проверить**\n1. \n2. \n",
  },
  {
    id: "decision",
    label: "Принятое решение",
    hint: "выбор и его причина",
    keywords: "решение выбор почему",
    insert: "**Решение**\n\n**Почему так, а не иначе**\n\n",
  },
  {
    id: "code",
    label: "Блок кода",
    hint: "```",
    keywords: "код сниппет",
    insert: "```\n\n```\n",
  },
  {
    id: "breaking",
    label: "Ломающее изменение",
    hint: "предупреждение",
    keywords: "breaking миграция внимание",
    insert: "> **Внимание:** ломающее изменение.\n> Что нужно сделать при обновлении: \n",
  },
];

export function PatchLogForm({ taskId }: { taskId: string }) {
  // SlashTextarea управляемая: текст держим здесь, иначе меню команд не
  // сможет подменить «/…» на вставку.
  const [content, setContent] = useState("");
  // Поле контролируемое, и form.reset() его не трогает — чистим сами, сразу
  // по результату действия, а не в эффекте на state.
  const [state, formAction, pending] = useActionState(
    async (prev: { error?: string } | undefined, formData: FormData) => {
      const res = await addPatchLogAction(prev, formData);
      if (!res?.error) setContent("");
      return res;
    },
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && !state.error) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-xl border border-edge bg-surface-2/40 p-4"
    >
      <input type="hidden" name="taskId" value={taskId} />
      <input
        name="title"
        required
        minLength={2}
        placeholder="Заголовок записи (например: «Реализован API эндпоинт оплаты»)"
        className="mb-2.5 w-full rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <SlashTextarea
        name="content"
        value={content}
        onValueChange={setContent}
        commands={TEMPLATES}
        onCommand={(command) =>
          TEMPLATES.find((t) => t.id === command.id)?.insert ?? ""
        }
        rows={3}
        placeholder="Полное описание реализации: что сделано, как, какие решения приняты… («/» — шаблон)"
        // className уходит на обёртку, а само поле фреймворк красит своим
        // .pl-input — оно уже собрано на тех же токенах, что и остальные поля.
        className="mb-3"
      />
      {state?.error && (
        <p className="mb-3 text-sm text-red-400">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold transition hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Сохраняем…" : "Добавить запись"}
      </button>
    </form>
  );
}
