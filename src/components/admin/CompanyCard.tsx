"use client";

import { useActionState, useState, useTransition } from "react";
import type { Role } from "@prisma/client";
import { ROLE_LABELS, initials } from "@/lib/labels";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  deleteCompanyAction,
  renameCompanyAction,
  setProjectCompanyAction,
  setUserCompanyAction,
} from "@/lib/actions/companies";

export type CompanyUserDTO = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
};

export type CompanyProjectDTO = { id: string; key: string; name: string };

export type CompanyDTO = {
  id: string;
  name: string;
  users: CompanyUserDTO[];
  projects: CompanyProjectDTO[];
};

/**
 * Карточка компании в админке: состав сотрудников и её проекты.
 * Сотрудник состоит максимум в одной компании, поэтому «добавить» здесь —
 * это перевод: в кандидатах только те, кто ещё никуда не распределён.
 */
export function CompanyCard({
  company,
  candidates,
  freeProjects,
  canDelete,
}: {
  company: CompanyDTO;
  /** Активные пользователи без компании. */
  candidates: CompanyUserDTO[];
  /** Проекты без компании, которые вызывающий вправе привязать. */
  freeProjects: CompanyProjectDTO[];
  /** Удалять компании может только администратор. */
  canDelete: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [renaming, setRenaming] = useState(false);
  const [asking, setAsking] = useState(false);
  const [pickedUser, setPickedUser] = useState("");
  const [pickedProject, setPickedProject] = useState("");

  const [renameState, renameAction, renamePending] = useActionState(
    async (prev: { error?: string; ok?: boolean } | undefined, formData: FormData) => {
      const res = await renameCompanyAction(company.id, prev, formData);
      if (res.ok) setRenaming(false);
      return res;
    },
    undefined
  );

  function addUser() {
    if (!pickedUser) return;
    const userId = pickedUser;
    setPickedUser("");
    startTransition(() => setUserCompanyAction(userId, company.id));
  }

  function addProject() {
    if (!pickedProject) return;
    const projectId = pickedProject;
    setPickedProject("");
    startTransition(() => setProjectCompanyAction(projectId, company.id));
  }

  const selectCls =
    "min-w-0 flex-1 rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-50";

  return (
    <section className="rounded-2xl border border-edge bg-surface p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {renaming ? (
          <form action={renameAction} className="flex flex-1 items-center gap-2">
            <input
              name="name"
              defaultValue={company.name}
              required
              minLength={2}
              maxLength={80}
              autoFocus
              className="min-w-0 flex-1 rounded-lg border border-edge bg-surface-2 px-3 py-1.5 text-sm outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={renamePending}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold transition hover:bg-accent-hover disabled:opacity-50"
            >
              Сохранить
            </button>
            <button
              type="button"
              onClick={() => setRenaming(false)}
              className="rounded-lg border border-edge px-3 py-1.5 text-xs text-muted transition hover:bg-surface-2"
            >
              Отмена
            </button>
          </form>
        ) : (
          <>
            <h2 className="text-base font-semibold">{company.name}</h2>
            <span className="text-xs text-muted">
              сотрудников: {company.users.length} · проектов: {company.projects.length}
            </span>
            <span className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRenaming(true)}
                className="rounded-lg border border-edge px-3 py-1.5 text-xs text-muted transition hover:bg-surface-2 hover:text-foreground"
              >
                Переименовать
              </button>
              {canDelete && (
                <button
                  type="button"
                  onClick={() => setAsking(true)}
                  className="rounded-lg border border-edge px-3 py-1.5 text-xs text-muted transition hover:bg-red-500/10 hover:text-red-400"
                >
                  Удалить
                </button>
              )}
            </span>
          </>
        )}
      </div>

      {renameState?.error && (
        <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {renameState.error}
        </p>
      )}

      <div className={`grid gap-5 md:grid-cols-2 ${pending ? "opacity-60" : ""}`}>
        {/* Сотрудники компании */}
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Сотрудники
          </h3>
          {company.users.length === 0 ? (
            <p className="mb-3 text-sm text-muted">Пока никого — добавьте сотрудников</p>
          ) : (
            <ul className="mb-3 space-y-1.5">
              {company.users.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center gap-2.5 rounded-xl border border-edge bg-surface-2/50 px-3 py-2"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[10px] font-bold text-accent-hover">
                    {initials(u.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {u.name}
                      {!u.active && <span className="ml-2 text-xs text-muted">отключён</span>}
                    </span>
                    <span className="block truncate text-xs text-muted">{u.email}</span>
                  </span>
                  <span className="shrink-0 rounded-md bg-surface px-2 py-0.5 text-[10px] text-muted">
                    {ROLE_LABELS[u.role]}
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => startTransition(() => setUserCompanyAction(u.id, null))}
                    data-tip="Убрать из компании"
                    aria-label={"Убрать из компании: " + u.name}
                    className="shrink-0 rounded-lg px-2 py-1 text-xs text-muted transition hover:bg-red-500/10 hover:text-red-400"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center gap-2">
            <select
              value={pickedUser}
              onChange={(e) => setPickedUser(e.target.value)}
              disabled={candidates.length === 0 || pending}
              aria-label="Сотрудник для добавления в компанию"
              className={selectCls}
            >
              <option value="">
                {candidates.length
                  ? "— Выберите сотрудника —"
                  : "Нераспределённых сотрудников нет"}
              </option>
              {candidates.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.email}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addUser}
              disabled={!pickedUser || pending}
              className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold transition hover:bg-accent-hover disabled:opacity-50"
            >
              Добавить
            </button>
          </div>
        </div>

        {/* Проекты компании */}
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Проекты
          </h3>
          {company.projects.length === 0 ? (
            <p className="mb-3 text-sm text-muted">Проектов пока нет</p>
          ) : (
            <ul className="mb-3 space-y-1.5">
              {company.projects.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-2.5 rounded-xl border border-edge bg-surface-2/50 px-3 py-2"
                >
                  <span className="shrink-0 rounded-md bg-accent/15 px-2 py-0.5 font-mono text-[10px] font-bold text-accent-hover">
                    {p.key}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => startTransition(() => setProjectCompanyAction(p.id, null))}
                    data-tip="Открепить от компании"
                    aria-label={"Открепить от компании: " + p.name}
                    className="shrink-0 rounded-lg px-2 py-1 text-xs text-muted transition hover:bg-red-500/10 hover:text-red-400"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center gap-2">
            <select
              value={pickedProject}
              onChange={(e) => setPickedProject(e.target.value)}
              disabled={freeProjects.length === 0 || pending}
              aria-label="Проект для привязки к компании"
              className={selectCls}
            >
              <option value="">
                {freeProjects.length ? "— Проект без компании —" : "Непривязанных проектов нет"}
              </option>
              {freeProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.key} · {p.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addProject}
              disabled={!pickedProject || pending}
              className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold transition hover:bg-accent-hover disabled:opacity-50"
            >
              Привязать
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={asking}
        title="Удалить компанию?"
        message="Сотрудники и проекты сохранятся, но потеряют привязку: такие проекты снова станут видны всем своим участникам."
        confirmLabel="Удалить"
        pending={pending}
        onConfirm={() => {
          setAsking(false);
          startTransition(() => deleteCompanyAction(company.id));
        }}
        onCancel={() => setAsking(false)}
      />
    </section>
  );
}
