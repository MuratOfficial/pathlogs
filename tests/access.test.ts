import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";

vi.mock("@/auth", async () => {
  const { authState } = await import("./auth-state");
  return {
    requireUser: async () => {
      if (!authState.user) throw new Error("Не авторизован");
      return authState.user;
    },
  };
});

import { prisma } from "@/lib/prisma";
import {
  canAccessProject,
  requireProjectMember,
  requireProjectManager,
  filterProjectMembers,
  isManager,
} from "@/lib/access";
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

describe("isManager", () => {
  it("менеджер и админ — менеджеры, разработчик — нет", () => {
    expect(isManager(fx.admin)).toBe(true);
    expect(isManager(fx.manager)).toBe(true);
    expect(isManager(fx.member)).toBe(false);
  });
});

describe("canAccessProject", () => {
  it("админ видит любой проект", async () => {
    expect(await canAccessProject(fx.project.id, fx.admin)).toBe(true);
  });

  it("владелец и участник видят проект", async () => {
    expect(await canAccessProject(fx.project.id, fx.owner)).toBe(true);
    expect(await canAccessProject(fx.project.id, fx.member)).toBe(true);
  });

  it("посторонний (даже с ролью менеджера) проект не видит", async () => {
    expect(await canAccessProject(fx.project.id, fx.outsider)).toBe(false);
  });

  it("участник одного проекта не видит другой", async () => {
    expect(await canAccessProject(fx.otherProject.id, fx.member)).toBe(false);
  });
});

describe("requireProjectMember", () => {
  it("пропускает участника", async () => {
    loginAs(fx.member);
    await expect(requireProjectMember(fx.project.id)).resolves.toMatchObject({
      id: fx.member.id,
    });
  });

  it("отклоняет постороннего", async () => {
    loginAs(fx.outsider);
    await expect(requireProjectMember(fx.project.id)).rejects.toThrow(
      "Нет доступа к проекту"
    );
  });
});

describe("requireProjectManager", () => {
  it("владелец управляет проектом независимо от глобальной роли", async () => {
    loginAs(fx.owner); // роль DEVELOPER, но владелец
    await expect(requireProjectManager(fx.project.id)).resolves.toMatchObject({
      id: fx.owner.id,
    });
  });

  it("менеджер-участник управляет проектом", async () => {
    loginAs(fx.manager);
    await expect(requireProjectManager(fx.project.id)).resolves.toMatchObject({
      id: fx.manager.id,
    });
  });

  it("админ управляет, даже не состоя в проекте", async () => {
    loginAs(fx.admin);
    await expect(requireProjectManager(fx.project.id)).resolves.toMatchObject({
      id: fx.admin.id,
    });
  });

  it("менеджер, не состоящий в проекте, — отказ", async () => {
    loginAs(fx.outsider);
    await expect(requireProjectManager(fx.project.id)).rejects.toThrow(
      "Требуются права менеджера проекта"
    );
  });

  it("рядовой участник-разработчик — отказ", async () => {
    loginAs(fx.member);
    await expect(requireProjectManager(fx.project.id)).rejects.toThrow(
      "Требуются права менеджера проекта"
    );
  });
});

describe("filterProjectMembers", () => {
  it("оставляет только участников проекта (включая владельца)", async () => {
    const result = await filterProjectMembers(fx.project.id, [
      fx.owner.id,
      fx.member.id,
      fx.outsider.id,
      fx.admin.id,
    ]);
    expect(result.sort()).toEqual([fx.owner.id, fx.member.id].sort());
  });

  it("пустой вход — пустой выход", async () => {
    expect(await filterProjectMembers(fx.project.id, [])).toEqual([]);
  });
});
