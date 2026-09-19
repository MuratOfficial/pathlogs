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

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { createBoardRuleAction } from "@/lib/actions/rules";
import { loginAs } from "./auth-state";
import { createFixtures, resetDb, type Fixtures } from "./fixtures";

let fx: Fixtures;

beforeEach(async () => {
  await resetDb();
  fx = await createFixtures();
  loginAs(fx.manager);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("createBoardRuleAction: всё из правила — из этого же проекта", () => {
  it("участник проекта в исполнителях правила допустим", async () => {
    await createBoardRuleAction(fx.project.id, {
      columnId: fx.cols.inProgress.id,
      assignUserId: fx.member.id,
    });

    const rule = await prisma.boardRule.findFirstOrThrow({
      where: { projectId: fx.project.id },
    });
    expect(rule.assignUserId).toBe(fx.member.id);
  });

  // Регрессия: проверялись колонка и метка, а исполнитель — нет, и правило
  // могло назначать на задачи человека со стороны.
  it("посторонний в исполнителях отклоняется", async () => {
    await expect(
      createBoardRuleAction(fx.project.id, {
        columnId: fx.cols.inProgress.id,
        assignUserId: fx.outsider.id,
      })
    ).rejects.toThrow("Исполнитель не участвует");

    expect(await prisma.boardRule.count()).toBe(0);
  });

  it("колонка чужого проекта отклоняется", async () => {
    await expect(
      createBoardRuleAction(fx.project.id, {
        columnId: fx.cols.otherTodo.id,
        setStatus: "DONE",
      })
    ).rejects.toThrow("Колонка не найдена");
  });

  it("метка чужого проекта отклоняется", async () => {
    const alienTag = await prisma.tag.create({
      data: { projectId: fx.otherProject.id, name: "чужая" },
    });

    await expect(
      createBoardRuleAction(fx.project.id, {
        columnId: fx.cols.inProgress.id,
        addTagId: alienTag.id,
      })
    ).rejects.toThrow("Метка не найдена");
  });

  it("правило без единого действия отклоняется", async () => {
    await expect(
      createBoardRuleAction(fx.project.id, { columnId: fx.cols.inProgress.id })
    ).rejects.toThrow("хотя бы одно действие");
  });

  it("посторонний правило не создаст", async () => {
    loginAs(fx.outsider);

    await expect(
      createBoardRuleAction(fx.project.id, {
        columnId: fx.cols.inProgress.id,
        setStatus: "DONE",
      })
    ).rejects.toThrow("владелец или менеджер проекта");
  });
});
