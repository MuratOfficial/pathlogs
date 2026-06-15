"use client";

import { useActionState, useState } from "react";
import {
  listTrelloBoardsAction,
  importTrelloBoardAction,
} from "@/lib/actions/trello";
import { buildTrelloAuthorizeUrl } from "@/lib/trello";

const inputCls =
  "w-full rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent";

/** Предлагает ключ проекта из латинских букв названия доски. */
function suggestKey(name: string): string {
  return (name.match(/[A-Za-z]/g) ?? []).join("").slice(0, 4).toUpperCase();
}

export function ImportTrelloDialog({ hasSaved = false }: { hasSaved?: boolean }) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [token, setToken] = useState("");
  const [remember, setRemember] = useState(true);
  const [useManual, setUseManual] = useState(false);
  const [boards, setBoards] = useState<{ id: string; name: string }[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [credError, setCredError] = useState<string | null>(null);
  const [selected, setSelected] = useState("");
  const [projKey, setProjKey] = useState("");

  const [state, formAction, pending] = useActionState(
    importTrelloBoardAction,
    undefined
  );

  const selectedBoard = boards?.find((b) => b.id === selected) ?? null;
  const usingSaved = hasSaved && !useManual;

  async function load(saved: boolean) {
    setLoading(true);
    setCredError(null);
    const res = saved
      ? await listTrelloBoardsAction()
      : await listTrelloBoardsAction(key.trim(), token.trim(), remember);
    setLoading(false);
    if (res.error) {
      setCredError(res.error);
      return;
    }
    const list = res.boards ?? [];
    setBoards(list);
    if (list.length) {
      setSelected(list[0]!.id);
      setProjKey(suggestKey(list[0]!.name));
    }
  }

  function openDialog() {
    setOpen(true);
    // С сохранёнными данными сразу подгружаем доски, минуя ввод кред
    if (usingSaved) void load(true);
  }

  function close() {
    setOpen(false);
  }

  function resetBoards() {
    setBoards(null);
    setSelected("");
    setProjKey("");
    setCredError(null);
    if (usingSaved) void load(true);
  }

  function switchToManual() {
    setUseManual(true);
    setBoards(null);
    setCredError(null);
  }

  function pickBoard(id: string) {
    setSelected(id);
    const b = boards?.find((x) => x.id === id);
    if (b) setProjKey(suggestKey(b.name));
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="flex items-center gap-2 rounded-lg border border-edge px-4 py-2 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-foreground"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M19.5 3h-15A1.5 1.5 0 003 4.5v15A1.5 1.5 0 004.5 21h15a1.5 1.5 0 001.5-1.5v-15A1.5 1.5 0 0019.5 3zM10.5 16.5a.75.75 0 01-.75.75H6.75a.75.75 0 01-.75-.75v-9a.75.75 0 01.75-.75h3a.75.75 0 01.75.75v9zm7.5-4a.75.75 0 01-.75.75h-3a.75.75 0 01-.75-.75v-5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75v5z" />
        </svg>
        Импорт из Trello
      </button>

      {open && (
        <div
          className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          <div className="animate-pop-in max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-edge bg-surface p-6 shadow-2xl">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Импорт из Trello</h2>
              <button
                onClick={close}
                className="text-muted transition hover:text-foreground"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Подсказка только при ручном вводе */}
            {!usingSaved && !boards && (
              <p className="mb-4 text-xs text-muted">
                Ключ и токен возьмите на{" "}
                <a
                  href="https://trello.com/power-ups/admin"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-hover underline"
                >
                  trello.com/power-ups/admin
                </a>
                .
              </p>
            )}

            {/* Загрузка по сохранённым данным */}
            {usingSaved && !boards && (
              <div className="space-y-3 py-2">
                {loading && <p className="text-sm text-muted">Загружаем доски Trello…</p>}
                {credError && (
                  <p className="text-sm text-red-400">{credError}</p>
                )}
                <button
                  type="button"
                  onClick={switchToManual}
                  className="text-xs text-accent-hover underline"
                >
                  Ввести другие данные
                </button>
              </div>
            )}

            {/* Шаг 1 — ручной ввод учётных данных */}
            {!usingSaved && !boards && (
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs text-muted">API key *</span>
                  <input
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="0123456789abcdef…"
                    className={`${inputCls} font-mono`}
                  />
                </label>
                <button
                  type="button"
                  disabled={key.trim().length < 8}
                  onClick={() =>
                    window.open(
                      buildTrelloAuthorizeUrl(key),
                      "_blank",
                      "noopener,noreferrer"
                    )
                  }
                  className="text-xs text-accent-hover underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
                >
                  Получить токен в Trello → скопируйте и вставьте ниже
                </button>
                <label className="block">
                  <span className="mb-1 block text-xs text-muted">Token *</span>
                  <input
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="ATTA…"
                    className={`${inputCls} font-mono`}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-muted">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 rounded border-edge accent-accent"
                  />
                  Запомнить эти данные (хранятся в зашифрованном виде)
                </label>
                {credError && <p className="text-sm text-red-400">{credError}</p>}
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={close}
                    className="rounded-lg border border-edge px-4 py-2 text-sm text-muted transition hover:bg-surface-2"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={() => load(false)}
                    disabled={loading || key.trim().length < 8 || token.trim().length < 8}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold transition hover:bg-accent-hover disabled:opacity-50"
                  >
                    {loading ? "Загружаем…" : "Загрузить доски"}
                  </button>
                </div>
              </div>
            )}

            {/* Шаг 2 — выбор доски и ключа проекта */}
            {boards && (
              <form action={formAction} className="space-y-3">
                {!usingSaved && (
                  <>
                    <input type="hidden" name="key" value={key.trim()} />
                    <input type="hidden" name="token" value={token.trim()} />
                  </>
                )}
                <input type="hidden" name="boardId" value={selected} />
                <input type="hidden" name="boardName" value={selectedBoard?.name ?? ""} />

                {boards.length === 0 ? (
                  <p className="text-sm text-muted">На аккаунте нет открытых досок.</p>
                ) : (
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted">Доска</span>
                    <select
                      value={selected}
                      onChange={(e) => pickBoard(e.target.value)}
                      className={inputCls}
                    >
                      {boards.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="block">
                  <span className="mb-1 block text-xs text-muted">
                    Ключ проекта (2–6 латинских букв)
                  </span>
                  <input
                    name="projectKey"
                    value={projKey}
                    onChange={(e) => setProjKey(e.target.value)}
                    required
                    minLength={2}
                    maxLength={6}
                    pattern="[A-Za-z]+"
                    placeholder="TRL"
                    className={`${inputCls} font-mono uppercase`}
                  />
                </label>

                {state?.error && (
                  <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                    {state.error}
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={resetBoards}
                    className="rounded-lg border border-edge px-4 py-2 text-sm text-muted transition hover:bg-surface-2"
                  >
                    Назад
                  </button>
                  <button
                    type="submit"
                    disabled={pending || boards.length === 0}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold transition hover:bg-accent-hover disabled:opacity-50"
                  >
                    {pending ? "Импортируем…" : "Импортировать"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
