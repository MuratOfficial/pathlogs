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
import {
  attachSubProjectAction,
  detachSubProjectAction,
} from "@/lib/actions/subprojects";
import {
  ancestorProjectIds,
  getAttachableProjects,
  getParentTasks,
  getSubProjects,
} from "@/lib/subprojects";
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

/** Третий проект, в котором member тоже участвует. */
async function thirdProject() {
  return prisma.project.create({
    data: {
      key: "THR",
      name: "Третий проект",
      ownerId: fx.member.id,
      members: { create: [{ userId: fx.member.id }] },
    },
  });
}

describe("привязка проекта как подзадачи", () => {
  it("участник обоих проектов привязывает проект к задаче", async () => {
    const third = await thirdProject();
    loginAs(fx.member);
    expect(await attachSubProjectAction(fx.task.id, third.id)).toEqual({});

    const subs = await getSubProjects(fx.task.id);
    expect(subs.map((s) => s.id)).toEqual([third.id]);
  });

  it("повторная привязка не создаёт дубль", async () => {
    const third = await thirdProject();
    loginAs(fx.member);
    await attachSubProjectAction(fx.task.id, third.id);
    await attachSubProjectAction(fx.task.id, third.id);
    expect(await prisma.taskProjectLink.count()).toBe(1);
  });

  it("проект самой задачи привязать нельзя", async () => {
    loginAs(fx.member);
    const res = await attachSubProjectAction(fx.task.id, fx.project.id);
    expect(res.error).toMatch(/из него самого/);
  });

  it("недоступный проект привязать нельзя", async () => {
    loginAs(fx.member);
    const res = await attachSubProjectAction(fx.task.id, fx.otherProject.id);
    expect(res.error).toMatch(/Нет доступа/);
  });

  it("посторонний не трогает чужую задачу", async () => {
    const third = await thirdProject();
    loginAs(fx.outsider);
    await expect(attachSubProjectAction(fx.task.id, third.id)).rejects.toThrow(/Нет доступа/);
  });

  it("кольцо из проектов не собрать", async () => {
    const third = await thirdProject();
    loginAs(fx.member);
    // THR становится подзадачей задачи из TST
    await attachSubProjectAction(fx.task.id, third.id);

    // …значит TST стоит выше THR, и обратную связь заводить нельзя
    const taskInThird = await prisma.task.create({
      data: { title: "Задача третьего", projectId: third.id, creatorId: fx.member.id },
    });
    const res = await attachSubProjectAction(taskInThird.id, fx.project.id);
    expect(res.error).toMatch(/выше по цепочке/);
  });

  it("отвязка убирает связь, но не проект", async () => {
    const third = await thirdProject();
    loginAs(fx.member);
    await attachSubProjectAction(fx.task.id, third.id);
    await detachSubProjectAction(fx.task.id, third.id);

    expect(await getSubProjects(fx.task.id)).toEqual([]);
    expect(await prisma.project.count({ where: { id: third.id } })).toBe(1);
  });
});

describe("прогресс и обратная ссылка", () => {
  it("считает выполненные задачи привязанного проекта", async () => {
    const third = await thirdProject();
    await prisma.task.createMany({
      data: [
        { title: "Готова", projectId: third.id, creatorId: fx.member.id, status: "DONE" },
        { title: "Закрыта", projectId: third.id, creatorId: fx.member.id, status: "CLOSED" },
        { title: "В работе", projectId: third.id, creatorId: fx.member.id },
      ],
    });
    loginAs(fx.member);
    await attachSubProjectAction(fx.task.id, third.id);

    const [sub] = await getSubProjects(fx.task.id);
    expect(sub).toMatchObject({ taskCount: 3, doneCount: 2, archived: false });
  });

  it("проект знает задачу, к которой привязан", async () => {
    const third = await thirdProject();
    loginAs(fx.member);
    await attachSubProjectAction(fx.task.id, third.id);

    expect(await getParentTasks(third.id)).toEqual([
      {
        id: fx.task.id,
        number: fx.task.number,
        title: fx.task.title,
        projectKey: fx.project.key,
      },
    ]);
  });
});

describe("список доступных для привязки проектов", () => {
  it("исключает свой проект, уже привязанные и предков", async () => {
    const third = await thirdProject();
    loginAs(fx.member);

    const before = await getAttachableProjects(fx.task.id, fx.project.id, fx.member);
    // Чужой OTH сюда не попадает — member в нём не состоит
    expect(before.map((p) => p.id)).toEqual([third.id]);

    await attachSubProjectAction(fx.task.id, third.id);
    expect(await getAttachableProjects(fx.task.id, fx.project.id, fx.member)).toEqual([]);

    // Из задачи третьего проекта предок TST тоже недоступен
    const taskInThird = await prisma.task.create({
      data: { title: "Задача третьего", projectId: third.id, creatorId: fx.member.id },
    });
    expect(await getAttachableProjects(taskInThird.id, third.id, fx.member)).toEqual([]);
  });
});

describe("ancestorProjectIds", () => {
  it("включает сам проект и всех, кто выше по цепочке", async () => {
    const third = await thirdProject();
    loginAs(fx.member);
    await attachSubProjectAction(fx.task.id, third.id);

    expect([...(await ancestorProjectIds(third.id))].sort()).toEqual(
      [third.id, fx.project.id].sort()
    );
    expect([...(await ancestorProjectIds(fx.project.id))]).toEqual([fx.project.id]);
  });
});
