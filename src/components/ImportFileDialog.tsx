"use client";

import { useActionState, useRef, useState } from "react";
import {
  importFileAction,
  previewImportAction,
  type ImportPreview,
} from "@/lib/actions/import";

const inputCls =
  "w-full rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent";

export function ImportFileDialog() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [projKey, setProjKey] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [state, formAction, pending] = useActionState(importFileAction, undefined);

  function close() {
    setOpen(false);
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setParseError(null);
    setName("");
    setProjKey("");
    if (fileRef.current) fileRef.current.value = "";
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview(null);
    setParseError(null);
  }

  async function doPreview() {
    if (!file) return;
    setLoading(true);
    setParseError(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await previewImportAction(undefined, fd);
    setLoading(false);
    if (res.error || !res.preview) {
      setParseError(res.error ?? "Не удалось прочитать файл");
      return;
    }
    setPreview(res.preview);
    setName(res.preview.suggestedName);
    setProjKey(res.preview.suggestedKey);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Импорт из файла"
        data-tip="Импорт из файла"
        className="flex items-center gap-2 rounded-lg border border-edge px-3 py-2 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-foreground sm:px-4"
      >
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L8 8m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
        </svg>
        <span className="hidden sm:inline">Импорт из файла</span>
      </button>

      {open && (
        <div
          className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          <div className="animate-pop-in max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-edge bg-surface p-6 shadow-2xl">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Импорт из Excel / MS Project</h2>
              <button onClick={close} className="text-muted transition hover:text-foreground">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="mb-4 text-xs text-muted">
              Поддерживаются файлы <b>.xlsx</b> (Excel) и <b>.xml</b> (экспорт MS Project).{" "}
              <a href="/api/import/template" className="text-accent-hover underline">
                Скачать шаблон Excel
              </a>
            </p>

            <form action={formAction} className="space-y-4">
              {/* Файл — единый input, остаётся смонтированным на обоих шагах,
                  чтобы форма импорта переотправила тот же файл. */}
              <label className={preview ? "hidden" : "block"}>
                <span className="mb-1 block text-xs text-muted">Файл</span>
                <input
                  ref={fileRef}
                  type="file"
                  name="file"
                  accept=".xlsx,.xls,.xlsm,.xml,.mpx"
                  onChange={onPick}
                  className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-accent-hover"
                />
              </label>

              {!preview && (
                <>
                  {parseError && (
                    <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                      {parseError}
                    </p>
                  )}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={close}
                      className="rounded-lg border border-edge px-4 py-2 text-sm text-muted transition hover:bg-surface-2"
                    >
                      Отмена
                    </button>
                    <button
                      type="button"
                      onClick={doPreview}
                      disabled={!file || loading}
                      className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-50"
                    >
                      {loading ? "Читаем файл…" : "Загрузить и проверить"}
                    </button>
                  </div>
                </>
              )}

              {preview && (
                <>
                  <div className="rounded-lg border border-edge bg-surface-2/50 px-3 py-2 text-sm">
                    <p>
                      Формат:{" "}
                      <b>{preview.format === "excel" ? "Excel" : "MS Project XML"}</b> · задач:{" "}
                      <b>{preview.total}</b>
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {preview.columnNames.length
                        ? `Колонки доски: ${preview.columnNames.join(", ")}`
                        : "Колонки доски по статусу задач"}
                      {preview.withAssignee > 0 &&
                        ` · с исполнителем: ${preview.withAssignee}`}
                      {preview.withParent > 0 && ` · подзадач: ${preview.withParent}`}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1 block text-xs text-muted">Название проекта</span>
                      <input
                        name="projectName"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        minLength={2}
                        maxLength={120}
                        className={inputCls}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs text-muted">Ключ (2–6 лат. букв)</span>
                      <input
                        name="projectKey"
                        value={projKey}
                        onChange={(e) => setProjKey(e.target.value)}
                        required
                        minLength={2}
                        maxLength={6}
                        pattern="[A-Za-z]+"
                        className={`${inputCls} font-mono uppercase`}
                      />
                    </label>
                  </div>

                  <div className="max-h-52 overflow-auto rounded-lg border border-edge">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-surface-2 text-muted">
                        <tr>
                          <th className="px-2 py-1.5 font-medium">Задача</th>
                          <th className="px-2 py-1.5 font-medium">Статус</th>
                          <th className="px-2 py-1.5 font-medium">Приоритет</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.sample.map((t, i) => (
                          <tr key={i} className="border-t border-edge/60">
                            <td className="max-w-[18rem] truncate px-2 py-1.5" data-tip={t.title}>
                              {t.title}
                            </td>
                            <td className="px-2 py-1.5 text-muted">{t.status}</td>
                            <td className="px-2 py-1.5 text-muted">{t.priority}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {preview.total > preview.sample.length && (
                      <p className="px-2 py-1.5 text-xs text-muted">
                        …и ещё {preview.total - preview.sample.length}
                      </p>
                    )}
                  </div>

                  {state?.error && (
                    <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                      {state.error}
                    </p>
                  )}

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={reset}
                      className="rounded-lg border border-edge px-4 py-2 text-sm text-muted transition hover:bg-surface-2"
                    >
                      Другой файл
                    </button>
                    <button
                      type="submit"
                      disabled={pending}
                      className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-50"
                    >
                      {pending ? "Импортируем…" : `Импортировать ${preview.total} задач`}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
}
