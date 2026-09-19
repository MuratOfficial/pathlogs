import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";

vi.mock("@/auth", async () => {
  const { authState } = await import("./auth-state");
  const requireUser = async () => {
    if (!authState.user) throw new Error("Не авторизован");
    return authState.user;
  };
  return {
    requireUser,
    requireAdmin: async () => {
      const user = await requireUser();
      if (user.role !== "ADMIN") throw new Error("Требуются права администратора");
      return user;
    },
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { currentSessionUser } from "@/lib/session";
import { toggleUserActiveAction, setUserRoleAction } from "@/lib/actions/admin";
import { loginAs } from "./auth-state";
import { createFixtures, resetDb, type Fixtures } from "./fixtures";

let fx: Fixtures;

beforeEach(async () => {
  await resetDb();
  fx = await createFixtures();
});

afterAll(async () => {
  await prisma.$disconnect();
});

/**
 * Роль и признак активности зашиты в JWT при входе, поэтому каждый следующий
 * запрос сверяет их с БД (см. колбэк jwt в src/auth.ts). Здесь проверяется сама
 * сверка: null означает «сессию закрыть».
 */
describe("currentSessionUser", () => {
  it("для активного пользователя отдаёт имя и роль", async () => {
    expect(await currentSessionUser(fx.member.id)).toEqual({
      name: fx.member.name,
      role: "DEVELOPER",
    });
  });

  it("деактивированный теряет сессию, а не ждёт истечения токена", async () => {
    loginAs(fx.admin);
    await toggleUserActiveAction(fx.member.id);

    expect(await currentSessionUser(fx.member.id)).toBeNull();
  });

  it("новая роль видна сразу же, без перелогина", async () => {
    loginAs(fx.admin);
    await setUserRoleAction(fx.member.id, "MANAGER");

    expect((await currentSessionUser(fx.member.id))?.role).toBe("MANAGER");
  });

  it("разжалованный админ теряет админские права в той же сессии", async () => {
    loginAs(fx.admin);
    await setUserRoleAction(fx.manager.id, "DEVELOPER");

    expect((await currentSessionUser(fx.manager.id))?.role).toBe("DEVELOPER");
  });

  it("удалённого пользователя нет — сессии тоже", async () => {
    await prisma.user.delete({ where: { id: fx.outsider.id } });

    expect(await currentSessionUser(fx.outsider.id)).toBeNull();
  });
});
