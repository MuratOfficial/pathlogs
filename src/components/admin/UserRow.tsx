"use client";

import { useState, useTransition } from "react";
import type { Role } from "@prisma/client";
import {
  setUserRoleAction,
  setUserRateAction,
  toggleUserActiveAction,
} from "@/lib/actions/admin";
import { ROLE_LABELS } from "@/lib/labels";

export function UserRow({
  user,
  isSelf,
}: {
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
    active: boolean;
    initials: string;
    createdAt: string;
    taskCount: number;
    patchLogCount: number;
    hourlyRate: number | null;
  };
  isSelf: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [rate, setRate] = useState(user.hourlyRate != null ? String(user.hourlyRate) : "");

  function commitRate() {
    const n = parseFloat(rate.replace(",", "."));
    const value = Number.isFinite(n) && n > 0 ? n : null;
    if (value === user.hourlyRate) return;
    startTransition(() => setUserRateAction(user.id, value));
  }

  return (
    <tr className={`border-t border-edge/60 ${pending ? "opacity-50" : ""} ${!user.active ? "opacity-60" : ""}`}>
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent-hover">
            {user.initials}
          </span>
          <div>
            <p className="font-medium">
              {user.name}
              {isSelf && <span className="ml-2 text-xs text-muted">(вы)</span>}
            </p>
            <p className="text-xs text-muted">{user.email}</p>
          </div>
        </div>
      </td>
      <td className="px-5 py-3">
        <select
          value={user.role}
          disabled={isSelf || pending}
          onChange={(e) =>
            startTransition(() => setUserRoleAction(user.id, e.target.value as Role))
          }
          className="rounded-lg border border-edge bg-surface-2 px-2 py-1.5 text-xs outline-none focus:border-accent disabled:opacity-50"
        >
          {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
      </td>
      <td className="px-5 py-3">
        <input
          type="number"
          min={0}
          step="100"
          value={rate}
          placeholder="—"
          disabled={pending}
          onChange={(e) => setRate(e.target.value)}
          onBlur={commitRate}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          data-tip="Ставка в час для расчёта стоимости"
          className="w-24 rounded-lg border border-edge bg-surface-2 px-2 py-1.5 text-xs outline-none focus:border-accent disabled:opacity-50"
        />
      </td>
      <td className="px-5 py-3 text-muted">{user.taskCount}</td>
      <td className="px-5 py-3 text-muted">{user.patchLogCount}</td>
      <td className="px-5 py-3 text-xs text-muted">{user.createdAt}</td>
      <td className="px-5 py-3">
        <button
          disabled={isSelf || pending}
          onClick={() => startTransition(() => toggleUserActiveAction(user.id))}
          className={`rounded-full px-3 py-1 text-xs font-medium transition disabled:cursor-not-allowed ${
            user.active
              ? "bg-emerald-500/15 text-emerald-400 hover:bg-red-500/15 hover:text-red-400"
              : "bg-red-500/15 text-red-400 hover:bg-emerald-500/15 hover:text-emerald-400"
          }`}
          data-tip={isSelf ? "Нельзя деактивировать себя" : user.active ? "Деактивировать" : "Активировать"}
        >
          {user.active ? "Активен" : "Отключён"}
        </button>
      </td>
    </tr>
  );
}
