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

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { canAccessProject, projectScope, projectCandidateFilter } from "@/lib/access";
import {
  createCompanyAction,
  deleteCompanyAction,
  renameCompanyAction,
  setProjectCompanyAction,
  setUserCompanyAction,
} from "@/lib/actions/companies";
import { addProjectMemberAction, createProjectAction } from "@/lib/actions/projects";
import { searchAction } from "@/lib/actions/search";
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

/** Заводит компанию и переводит в неё перечисленных пользователей. */
async function company(name: string, userIds: string[] = []) {
  const c = await prisma.company.create({ data: { name } });
  if (userIds.length) {
    await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { companyId: c.id },
    });
  }
  return c;
}

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("создание компании", () => {
  it("менеджер создаёт компанию и сам в неё попадает", async () => {
    loginAs(fx.manager);
    expect(await createCompanyAction(undefined, form({ name: "Ромашка" }))).toEqual({});

    const created = await prisma.company.findUniqueOrThrow({
      where: { name: "Ромашка" },
      include: { users: { select: { id: true } } },
    });
    expect(created.users.map((u) => u.id)).toEqual([fx.manager.id]);
  });

  it("админ создаёт компанию, но сотрудником её не становится", async () => {
    loginAs(fx.admin);
    await createCompanyAction(undefined, form({ name: "Ромашка" }));
    const admin = await prisma.user.findUniqueOrThrow({ where: { id: fx.admin.id } });
    expect(admin.companyId).toBeNull();
  });

  it("разработчику компанию не создать", async () => {
    loginAs(fx.member);
    await expect(createCompanyAction(undefined, form({ name: "Ромашка" }))).rejects.toThrow(
      /администраторы и менеджеры/
    );
  });

  it("имя компании уникально", async () => {
    await company("Ромашка");
    loginAs(fx.admin);
    const res = await createCompanyAction(undefined, form({ name: "Ромашка" }));
    expect(res.error).toMatch(/уже есть/);
  });
});

describe("состав компании", () => {
  it("менеджер добавляет сотрудника в свою компанию", async () => {
    const c = await company("Ромашка", [fx.manager.id]);
    loginAs(fx.manager);
    await setUserCompanyAction(fx.member.id, c.id);

    const member = await prisma.user.findUniqueOrThrow({ where: { id: fx.member.id } });
    expect(member.companyId).toBe(c.id);
  });

  it("менеджер не трогает чужую компанию", async () => {
    await company("Ромашка", [fx.manager.id]);
    const alien = await company("Лютик");
    loginAs(fx.manager);
    await expect(setUserCompanyAction(fx.member.id, alien.id)).rejects.toThrow(/чужая/);
    await expect(renameCompanyAction(alien.id, undefined, form({ name: "Другое" }))).rejects.toThrow(
      /чужая/
    );
  });

  it("менеджер не уводит сотрудника из чужой компании", async () => {
    await company("Ромашка", [fx.manager.id]);
    await company("Лютик", [fx.member.id]);
    loginAs(fx.manager);
    await expect(setUserCompanyAction(fx.member.id, null)).rejects.toThrow(/чужая/);
  });

  it("удалить компанию может только админ; сотрудники остаются", async () => {
    const c = await company("Ромашка", [fx.manager.id, fx.member.id]);
    loginAs(fx.manager);
    await expect(deleteCompanyAction(c.id)).rejects.toThrow(/администратор/);

    loginAs(fx.admin);
    await deleteCompanyAction(c.id);
    const member = await prisma.user.findUniqueOrThrow({ where: { id: fx.member.id } });
    expect(member.companyId).toBeNull();
  });
});

describe("видимость проектов по компаниям", () => {
  it("проект чужой компании недоступен даже участнику", async () => {
    const alien = await company("Лютик");
    await prisma.project.update({
      where: { id: fx.project.id },
      data: { companyId: alien.id },
    });
    // member состоит в проекте, но не в компании проекта
    expect(await canAccessProject(fx.project.id, fx.member)).toBe(false);
    expect(await canAccessProject(fx.project.id, fx.owner)).toBe(false);
    // админ видит всё: он же и распределяет проекты по компаниям
    expect(await canAccessProject(fx.project.id, fx.admin)).toBe(true);
  });

  it("проект своей компании доступен участнику", async () => {
    const c = await company("Ромашка", [fx.member.id, fx.owner.id]);
    await prisma.project.update({
      where: { id: fx.project.id },
      data: { companyId: c.id },
    });
    expect(await canAccessProject(fx.project.id, fx.member)).toBe(true);
  });

  it("проект без компании остаётся доступен участнику из компании", async () => {
    await company("Ромашка", [fx.member.id]);
    expect(await canAccessProject(fx.project.id, fx.member)).toBe(true);
  });

  it("projectScope отбирает только проекты своего контура", async () => {
    const mine = await company("Ромашка", [fx.member.id]);
    const alien = await company("Лютик");
    await prisma.project.update({
      where: { id: fx.project.id },
      data: { companyId: alien.id },
    });
    const own = await prisma.project.create({
      data: {
        key: "OWN",
        name: "Проект компании",
        ownerId: fx.member.id,
        companyId: mine.id,
        members: { create: [{ userId: fx.member.id }] },
      },
    });

    const found = await prisma.project.findMany({
      where: await projectScope(fx.member),
      select: { id: true },
    });
    expect(found.map((p) => p.id)).toEqual([own.id]);
  });
});

describe("проекты и состав участников", () => {
  it("новый проект наследует компанию создателя", async () => {
    const c = await company("Ромашка", [fx.manager.id]);
    loginAs(fx.manager);
    // createProjectAction завершится redirect-ом — он нам не важен
    await createProjectAction(undefined, form({ name: "Новый", key: "NEW" })).catch(() => {});

    const created = await prisma.project.findUniqueOrThrow({ where: { key: "NEW" } });
    expect(created.companyId).toBe(c.id);
  });

  it("в проект компании не добавить человека из другой компании", async () => {
    const mine = await company("Ромашка", [fx.owner.id]);
    await company("Лютик", [fx.outsider.id]);
    await prisma.project.update({
      where: { id: fx.project.id },
      data: { companyId: mine.id },
    });

    loginAs(fx.owner);
    await expect(addProjectMemberAction(fx.project.id, fx.outsider.id)).rejects.toThrow(
      /другой компании/
    );
  });

  it("в кандидаты попадают только сотрудники компании проекта", async () => {
    const mine = await company("Ромашка", [fx.owner.id, fx.member.id]);
    await company("Лютик", [fx.outsider.id]);
    await prisma.project.update({
      where: { id: fx.project.id },
      data: { companyId: mine.id },
    });

    const candidates = await prisma.user.findMany({
      where: await projectCandidateFilter(fx.project.id),
      select: { id: true },
    });
    expect(candidates.map((c) => c.id).sort()).toEqual([fx.member.id, fx.owner.id].sort());
  });
});

describe("привязка проекта к компании", () => {
  it("админ привязывает и отвязывает любой проект", async () => {
    const c = await company("Ромашка");
    loginAs(fx.admin);
    await setProjectCompanyAction(fx.project.id, c.id);
    expect((await prisma.project.findUniqueOrThrow({ where: { id: fx.project.id } })).companyId).toBe(
      c.id
    );

    await setProjectCompanyAction(fx.project.id, null);
    expect(
      (await prisma.project.findUniqueOrThrow({ where: { id: fx.project.id } })).companyId
    ).toBeNull();
  });

  it("менеджер привязывает проект только к своей компании", async () => {
    await company("Ромашка", [fx.manager.id]);
    const alien = await company("Лютик");
    loginAs(fx.manager);
    await expect(setProjectCompanyAction(fx.project.id, alien.id)).rejects.toThrow(/чужая/);
  });
});

describe("поиск в командной палитре", () => {
  it("не показывает проекты вне доступа даже при совпадении по названию", async () => {
    loginAs(fx.member);
    const res = await searchAction("проект");
    // OTH member недоступен: он не участник, и раньше фильтр доступа
    // затирался условием поиска по названию
    expect(res.projects.map((p) => p.id)).toEqual([fx.project.id]);
  });

  it("не показывает проекты чужой компании", async () => {
    const alien = await company("Лютик");
    await prisma.project.update({
      where: { id: fx.project.id },
      data: { companyId: alien.id },
    });
    loginAs(fx.member);
    expect((await searchAction("проект")).projects).toEqual([]);
  });
});
