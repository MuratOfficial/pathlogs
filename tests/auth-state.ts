import type { SessionUser } from "@/lib/access";

/** Текущий «залогиненный» пользователь для мока @/auth. */
export const authState: { user: SessionUser | null } = { user: null };

export function loginAs(u: SessionUser) {
  authState.user = { id: u.id, email: u.email, name: u.name, role: u.role };
}
