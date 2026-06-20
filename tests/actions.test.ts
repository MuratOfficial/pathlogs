import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";

vi.mock("@/auth", async () => {
  const { authState } = await import("./auth-state");
  return {
    requireUser: async () => {
      if (!authState.user) throw new Error("Не авторизован");
      return authState.user;
    },
    signIn: vi.fn(),
    signOut: vi.fn(),
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// next-auth тянет next/server, недоступный в vitest — нужен только класс ошибки
vi.mock("next-auth", () => ({
  AuthError: class AuthError extends Error {},
}));

import { prisma } from "@/lib/prisma";
import {
  createTaskAction,
  deleteTaskAction,
  updateTaskStatusAction,
  updateTaskFieldsAction,
  addTaskLinkAction,
  addChecklistItemAction,
  toggleChecklistItemAction,
  deleteChecklistItemAction,
  addCommentAction,
  deleteCommentAction,
} from "@/lib/actions/tasks";
import { changePasswordAction } from "@/lib/actions/auth";
import bcrypt from "bcryptjs";
import {
  createBoardColumnAction,
  deleteBoardColumnAction,
  moveTaskToColumnAction,
  moveTaskAction,
  reorderColumnsAction,
  updateBoardColumnAction,
} from "@/lib/actions/board";
import {
  removeProjectMemberAction,
  toggleProjectArchiveAction,
} from "@/lib/actions/projects";
import { createTemplateAction, deleteTemplateAction } from "@/lib/actions/templates";
import { saveFilterAction, deleteFilterAction } from "@/lib/actions/filters";
import { createApiTokenAction, revokeApiTokenAction } from "@/lib/actions/tokens";
import { authenticateToken } from "@/lib/tokens";
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

function taskForm(projectId: string, extra: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("title", "Новая задача");
  fd.set("projectId", projectId);
  fd.set("type", "FEATURE");
  fd.set("priority", "MEDIUM");
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

describe("createTaskAction", () => {
  it("участник создаёт задачу", async () => {
    loginAs(fx.member);
    await expect(createTaskAction(undefined, taskForm(fx.project.id))).resolves.toEqual({});
    const count = await prisma.task.count({ where: { projectId: fx.project.id } });
    expect(count).toBe(2);
  });

  it("посторонний — отказ", async () => {
    loginAs(fx.outsider);
    await expect(createTaskAction(undefined, taskForm(fx.project.id))).rejects.toThrow(
      "Нет доступа к проекту"
    );
  });

  it("родитель из другого проекта — отказ", async () => {
    loginAs(fx.member);
    const res = await createTaskAction(
      undefined,
      taskForm(fx.project.id, { parentId: fx.otherTask.id })
    );
    expect(res.error).toBe("Родительская задача из другого проекта");
  });

  it("исполнители не из проекта отбрасываются", async () => {
    loginAs(fx.member);
    const fd = taskForm(fx.project.id);
    fd.append("assigneeIds", fx.member.id);
    fd.append("assigneeIds", fx.outsider.id);
    await createTaskAction(undefined, fd);
    const created = await prisma.task.findFirstOrThrow({
      where: { title: "Новая задача" },
      include: { assignees: true },
    });
    expect(created.assignees.map((a) => a.id)).toEqual([fx.member.id]);
  });
});

describe("чек-лист", () => {
  it("создание задачи с чек-листом «пункт на строку»", async () => {
    loginAs(fx.member);
    const fd = taskForm(fx.project.id, {
      checklist: "- [ ] Написать тесты\nОбновить доку\n\n* Проверить на staging",
    });
    await createTaskAction(undefined, fd);
    const created = await prisma.task.findFirstOrThrow({
      where: { title: "Новая задача" },
      include: { checklist: { orderBy: { order: "asc" } } },
    });
    expect(created.checklist.map((i) => i.text)).toEqual([
      "Написать тесты",
      "Обновить доку",
      "Проверить на staging",
    ]);
    expect(created.checklist.every((i) => !i.done)).toBe(true);
  });

  it("участник добавляет и отмечает пункт", async () => {
    loginAs(fx.member);
    await addChecklistItemAction(fx.task.id, "Проверить миграцию");
    const item = await prisma.checklistItem.findFirstOrThrow({
      where: { taskId: fx.task.id },
    });
    expect(item.done).toBe(false);

    await toggleChecklistItemAction(item.id, true);
    expect(
      (await prisma.checklistItem.findUniqueOrThrow({ where: { id: item.id } })).done
    ).toBe(true);
  });

  it("посторонний не трогает чек-лист", async () => {
    loginAs(fx.member);
    await addChecklistItemAction(fx.task.id, "Пункт");
    const item = await prisma.checklistItem.findFirstOrThrow({
      where: { taskId: fx.task.id },
    });

    loginAs(fx.outsider);
    await expect(addChecklistItemAction(fx.task.id, "Взлом")).rejects.toThrow(
      "Нет доступа к проекту"
    );
    await expect(toggleChecklistItemAction(item.id, true)).rejects.toThrow(
      "Нет доступа к проекту"
    );
    await expect(deleteChecklistItemAction(item.id)).rejects.toThrow(
      "Нет доступа к проекту"
    );
  });
});

function commentForm(taskId: string, content: string, mentions?: string[]) {
  const fd = new FormData();
  fd.set("taskId", taskId);
  fd.set("content", content);
  if (mentions) fd.set("mentions", mentions.join(","));
  return fd;
}

describe("комментарии и уведомления", () => {
  it("комментарий уведомляет автора задачи, но не комментатора", async () => {
    loginAs(fx.manager);
    await expect(
      addCommentAction(undefined, commentForm(fx.task.id, "Согласовано, берём в спринт"))
    ).resolves.toEqual({});

    const comment = await prisma.comment.findFirstOrThrow({
      where: { taskId: fx.task.id },
    });
    expect(comment.authorId).toBe(fx.manager.id);

    // Автор задачи (member) получил уведомление, сам комментатор — нет
    expect(
      await prisma.notification.count({
        where: { userId: fx.member.id, type: "COMMENT", taskId: fx.task.id },
      })
    ).toBe(1);
    expect(
      await prisma.notification.count({ where: { userId: fx.manager.id } })
    ).toBe(0);
  });

  it("@упоминание шлёт MENTION упомянутому и не дублирует COMMENT", async () => {
    // owner — автор не задачи, добавим его в наблюдатели через назначение
    loginAs(fx.member);
    await updateTaskFieldsAction(fx.task.id, { assigneeIds: [fx.owner.id] });
    // member комментирует и упоминает manager
    await addCommentAction(
      undefined,
      commentForm(fx.task.id, "Глянь, @Менеджер", [fx.manager.id])
    );
    // Упомянутый менеджер получил MENTION (и не получил COMMENT)
    expect(
      await prisma.notification.count({
        where: { userId: fx.manager.id, type: "MENTION" },
      })
    ).toBe(1);
    expect(
      await prisma.notification.count({
        where: { userId: fx.manager.id, type: "COMMENT" },
      })
    ).toBe(0);
    // Наблюдатель owner получил обычный COMMENT
    expect(
      await prisma.notification.count({
        where: { userId: fx.owner.id, type: "COMMENT" },
      })
    ).toBe(1);
  });

  it("упоминание постороннего (не участника) игнорируется", async () => {
    loginAs(fx.member);
    await addCommentAction(
      undefined,
      commentForm(fx.task.id, "@Посторонний привет", [fx.outsider.id])
    );
    expect(
      await prisma.notification.count({ where: { userId: fx.outsider.id } })
    ).toBe(0);
  });

  it("посторонний не комментирует", async () => {
    loginAs(fx.outsider);
    await expect(
      addCommentAction(undefined, commentForm(fx.task.id, "Мнение со стороны"))
    ).rejects.toThrow("Нет доступа к проекту");
  });

  it("удалять можно только свои комментарии (или админу)", async () => {
    loginAs(fx.member);
    await addCommentAction(undefined, commentForm(fx.task.id, "Мой комментарий"));
    const comment = await prisma.comment.findFirstOrThrow({
      where: { taskId: fx.task.id },
    });

    loginAs(fx.manager);
    await expect(deleteCommentAction(comment.id)).rejects.toThrow(
      "Можно удалять только свои комментарии"
    );

    loginAs(fx.admin);
    await deleteCommentAction(comment.id);
    expect(await prisma.comment.findUnique({ where: { id: comment.id } })).toBeNull();
  });

  it("назначение исполнителя уведомляет один раз, повтор состава — не дублирует", async () => {
    loginAs(fx.member);
    await updateTaskFieldsAction(fx.task.id, { assigneeIds: [fx.manager.id] });
    expect(
      await prisma.notification.count({
        where: { userId: fx.manager.id, type: "ASSIGNED" },
      })
    ).toBe(1);

    await updateTaskFieldsAction(fx.task.id, { assigneeIds: [fx.manager.id] });
    expect(
      await prisma.notification.count({
        where: { userId: fx.manager.id, type: "ASSIGNED" },
      })
    ).toBe(1);
  });

  it("смена статуса уведомляет наблюдателей задачи, кроме инициатора", async () => {
    loginAs(fx.member);
    await updateTaskFieldsAction(fx.task.id, { assigneeIds: [fx.manager.id] });

    loginAs(fx.manager);
    await updateTaskStatusAction(fx.task.id, "IN_PROGRESS");
    // Автор задачи (member) уведомлён, инициатор (manager, он же исполнитель) — нет
    expect(
      await prisma.notification.count({
        where: { userId: fx.member.id, type: "STATUS" },
      })
    ).toBe(1);
    expect(
      await prisma.notification.count({
        where: { userId: fx.manager.id, type: "STATUS" },
      })
    ).toBe(0);
  });
});

describe("changePasswordAction", () => {
  function passwordForm(current: string, next: string, confirm = next) {
    const fd = new FormData();
    fd.set("current", current);
    fd.set("next", next);
    fd.set("confirm", confirm);
    return fd;
  }

  it("неверный текущий пароль — отказ, верный — смена", async () => {
    await prisma.user.update({
      where: { id: fx.member.id },
      data: { passwordHash: await bcrypt.hash("oldpass123", 4) },
    });
    loginAs(fx.member);

    const bad = await changePasswordAction(undefined, passwordForm("wrong", "newpass123"));
    expect(bad.error).toBe("Текущий пароль неверен");

    const mismatch = await changePasswordAction(
      undefined,
      passwordForm("oldpass123", "newpass123", "другой")
    );
    expect(mismatch.error).toBe("Пароли не совпадают");

    const ok = await changePasswordAction(undefined, passwordForm("oldpass123", "newpass123"));
    expect(ok.success).toBeTruthy();
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: fx.member.id } });
    expect(await bcrypt.compare("newpass123", updated.passwordHash!)).toBe(true);
  });

  it("OAuth-аккаунт без пароля устанавливает пароль без текущего", async () => {
    await prisma.user.update({
      where: { id: fx.member.id },
      data: { passwordHash: null },
    });
    loginAs(fx.member);
    const res = await changePasswordAction(undefined, passwordForm("", "freshpass1"));
    expect(res.success).toBeTruthy();
  });
});

describe("deleteTaskAction", () => {
  it("автор удаляет свою задачу", async () => {
    loginAs(fx.member);
    await deleteTaskAction(fx.task.id);
    expect(await prisma.task.findUnique({ where: { id: fx.task.id } })).toBeNull();
  });

  it("менеджер проекта удаляет чужую задачу", async () => {
    loginAs(fx.manager);
    await deleteTaskAction(fx.task.id);
    expect(await prisma.task.findUnique({ where: { id: fx.task.id } })).toBeNull();
  });

  it("участник-разработчик не может удалить чужую задачу", async () => {
    const ownerTask = await prisma.task.create({
      data: { title: "Задача владельца", projectId: fx.project.id, creatorId: fx.owner.id },
    });
    loginAs(fx.member);
    await expect(deleteTaskAction(ownerTask.id)).rejects.toThrow(
      "Удалять задачу может её автор, менеджер или владелец проекта"
    );
  });

  it("посторонний — отказ ещё на членстве", async () => {
    loginAs(fx.outsider);
    await expect(deleteTaskAction(fx.task.id)).rejects.toThrow("Нет доступа к проекту");
  });
});

describe("updateTaskStatusAction / updateTaskFieldsAction", () => {
  it("посторонний не меняет статус", async () => {
    loginAs(fx.outsider);
    await expect(updateTaskStatusAction(fx.task.id, "DONE")).rejects.toThrow(
      "Нет доступа к проекту"
    );
  });

  it("смена статуса синхронизирует колонку", async () => {
    loginAs(fx.member);
    await updateTaskStatusAction(fx.task.id, "IN_PROGRESS");
    const updated = await prisma.task.findUniqueOrThrow({ where: { id: fx.task.id } });
    expect(updated.status).toBe("IN_PROGRESS");
    expect(updated.columnId).toBe(fx.cols.inProgress.id);
  });

  it("DONE проставляет closedAt и сбрасывает колонку (нет колонки DONE), возврат в TODO — сбрасывает closedAt", async () => {
    loginAs(fx.member);
    await updateTaskStatusAction(fx.task.id, "DONE");
    let t = await prisma.task.findUniqueOrThrow({ where: { id: fx.task.id } });
    expect(t.status).toBe("DONE");
    expect(t.closedAt).not.toBeNull();
    expect(t.columnId).toBeNull(); // в фикстурах нет колонки со статусом DONE

    // Снятие отметки (как повторный клик по галочке в канбане)
    await updateTaskStatusAction(fx.task.id, "TODO");
    t = await prisma.task.findUniqueOrThrow({ where: { id: fx.task.id } });
    expect(t.status).toBe("TODO");
    expect(t.closedAt).toBeNull();
    expect(t.columnId).toBe(fx.cols.todo.id);
  });

  it("исполнители фильтруются по участникам проекта", async () => {
    loginAs(fx.member);
    await updateTaskFieldsAction(fx.task.id, {
      assigneeIds: [fx.manager.id, fx.outsider.id],
    });
    const updated = await prisma.task.findUniqueOrThrow({
      where: { id: fx.task.id },
      include: { assignees: true },
    });
    expect(updated.assignees.map((a) => a.id)).toEqual([fx.manager.id]);
  });
});

describe("addTaskLinkAction", () => {
  it("связь между проектами запрещена", async () => {
    loginAs(fx.member);
    await expect(
      addTaskLinkAction(fx.task.id, fx.otherTask.id, "RELATES")
    ).rejects.toThrow("Связывать можно только задачи одного проекта");
  });
});

describe("board actions", () => {
  it("участник создаёт колонку, посторонний — нет", async () => {
    loginAs(fx.member);
    const res = await createBoardColumnAction(fx.project.id, "Ревью кода", "#60a5fa");
    expect(res.column?.name).toBe("Ревью кода");

    loginAs(fx.outsider);
    await expect(
      createBoardColumnAction(fx.project.id, "Взлом", "#ef4444")
    ).rejects.toThrow("Нет доступа к проекту");
  });

  it("перенос в колонку чужого проекта запрещён", async () => {
    loginAs(fx.member);
    await expect(
      moveTaskToColumnAction(fx.task.id, fx.cols.otherTodo.id)
    ).rejects.toThrow("Колонка принадлежит другому проекту");
  });

  it("кастомная колонка не меняет статус, статусная — меняет", async () => {
    loginAs(fx.member);
    await moveTaskToColumnAction(fx.task.id, fx.cols.custom.id);
    let t = await prisma.task.findUniqueOrThrow({ where: { id: fx.task.id } });
    expect(t.status).toBe("TODO");
    expect(t.columnId).toBe(fx.cols.custom.id);

    await moveTaskToColumnAction(fx.task.id, fx.cols.inProgress.id);
    t = await prisma.task.findUniqueOrThrow({ where: { id: fx.task.id } });
    expect(t.status).toBe("IN_PROGRESS");
  });

  it("удаление колонки: разработчику нельзя, менеджеру можно, статусную — никому", async () => {
    loginAs(fx.member);
    await expect(deleteBoardColumnAction(fx.cols.custom.id)).rejects.toThrow(
      "Требуются права менеджера проекта"
    );

    loginAs(fx.manager);
    await expect(deleteBoardColumnAction(fx.cols.todo.id)).rejects.toThrow(
      "Стандартную колонку удалить нельзя"
    );
    await deleteBoardColumnAction(fx.cols.custom.id);
    expect(
      await prisma.boardColumn.findUnique({ where: { id: fx.cols.custom.id } })
    ).toBeNull();
  });
});

describe("moveTaskAction (перенос с позицией)", () => {
  async function makeTasks(n: number) {
    const ids: string[] = [];
    for (let i = 0; i < n; i++) {
      const t = await prisma.task.create({
        data: {
          title: `Карточка ${i}`,
          projectId: fx.project.id,
          creatorId: fx.member.id,
          columnId: fx.cols.todo.id,
          status: "TODO",
          order: i,
        },
      });
      ids.push(t.id);
    }
    return ids;
  }

  it("переупорядочивает карточки внутри колонки по списку", async () => {
    loginAs(fx.member);
    const [a, b, c] = await makeTasks(3);
    // Переносим c в начало: c, a, b
    await moveTaskAction(c, fx.cols.todo.id, [c, a, b]);
    const orders = Object.fromEntries(
      (
        await prisma.task.findMany({
          where: { id: { in: [a, b, c] } },
          select: { id: true, order: true },
        })
      ).map((t) => [t.id, t.order])
    );
    expect(orders[c]).toBeLessThan(orders[a]);
    expect(orders[a]).toBeLessThan(orders[b]);
  });

  it("перенос в статусную колонку меняет статус и порядок", async () => {
    loginAs(fx.member);
    await moveTaskAction(fx.task.id, fx.cols.inProgress.id, [fx.task.id]);
    const t = await prisma.task.findUniqueOrThrow({ where: { id: fx.task.id } });
    expect(t.status).toBe("IN_PROGRESS");
    expect(t.columnId).toBe(fx.cols.inProgress.id);
    expect(t.order).toBe(0);
  });

  it("посторонний не может переносить", async () => {
    loginAs(fx.outsider);
    await expect(
      moveTaskAction(fx.task.id, fx.cols.todo.id, [fx.task.id])
    ).rejects.toThrow("Нет доступа к проекту");
  });

  it("колонка чужого проекта запрещена", async () => {
    loginAs(fx.member);
    await expect(
      moveTaskAction(fx.task.id, fx.cols.otherTodo.id, [fx.task.id])
    ).rejects.toThrow("Колонка принадлежит другому проекту");
  });
});

describe("reorderColumnsAction", () => {
  it("участник переставляет колонки", async () => {
    loginAs(fx.member);
    const reversed = [fx.cols.custom.id, fx.cols.inProgress.id, fx.cols.todo.id];
    await reorderColumnsAction(fx.project.id, reversed);
    const cols = await prisma.boardColumn.findMany({
      where: { projectId: fx.project.id },
      orderBy: { order: "asc" },
      select: { id: true },
    });
    expect(cols.map((c) => c.id)).toEqual(reversed);
  });

  it("посторонний — отказ", async () => {
    loginAs(fx.outsider);
    await expect(
      reorderColumnsAction(fx.project.id, [fx.cols.todo.id])
    ).rejects.toThrow("Нет доступа к проекту");
  });

  it("колонка чужого проекта в списке — отказ", async () => {
    loginAs(fx.member);
    await expect(
      reorderColumnsAction(fx.project.id, [fx.cols.todo.id, fx.cols.otherTodo.id])
    ).rejects.toThrow("Колонка из другого проекта");
  });
});

describe("WIP-лимиты колонок", () => {
  it("участник задаёт и снимает лимит", async () => {
    loginAs(fx.member);
    await updateBoardColumnAction(fx.cols.inProgress.id, { wipLimit: 3 });
    expect(
      (await prisma.boardColumn.findUniqueOrThrow({ where: { id: fx.cols.inProgress.id } })).wipLimit
    ).toBe(3);
    // 0 или отрицательное снимает лимит
    await updateBoardColumnAction(fx.cols.inProgress.id, { wipLimit: 0 });
    expect(
      (await prisma.boardColumn.findUniqueOrThrow({ where: { id: fx.cols.inProgress.id } })).wipLimit
    ).toBeNull();
  });
});

describe("шаблоны задач", () => {
  function tplForm(projectId: string, extra: Record<string, string> = {}) {
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("name", "Релиз");
    fd.set("type", "MANAGEMENT");
    fd.set("priority", "HIGH");
    for (const [k, v] of Object.entries(extra)) fd.set(k, v);
    return fd;
  }

  it("менеджер создаёт шаблон, посторонний — нет", async () => {
    loginAs(fx.manager);
    await expect(
      createTemplateAction(undefined, tplForm(fx.project.id, { checklist: "a\nb" }))
    ).resolves.toEqual({});
    const tpl = await prisma.taskTemplate.findFirstOrThrow({ where: { projectId: fx.project.id } });
    expect(tpl.name).toBe("Релиз");

    loginAs(fx.outsider);
    await expect(createTemplateAction(undefined, tplForm(fx.project.id))).rejects.toThrow(
      "Требуются права менеджера проекта"
    );
  });

  it("разработчик-участник не создаёт и не удаляет шаблон", async () => {
    loginAs(fx.manager);
    await createTemplateAction(undefined, tplForm(fx.project.id));
    const tpl = await prisma.taskTemplate.findFirstOrThrow({ where: { projectId: fx.project.id } });

    loginAs(fx.member);
    await expect(createTemplateAction(undefined, tplForm(fx.project.id))).rejects.toThrow(
      "Требуются права менеджера проекта"
    );
    await expect(deleteTemplateAction(tpl.id)).rejects.toThrow(
      "Требуются права менеджера проекта"
    );
  });
});

describe("сохранённые фильтры", () => {
  it("создаются на пользователя и удаляются только владельцем", async () => {
    loginAs(fx.member);
    await saveFilterAction(fx.project.id, "Мои баги", "status=TODO&type=BUG");
    const f = await prisma.savedFilter.findFirstOrThrow({ where: { userId: fx.member.id } });
    expect(f.query).toBe("status=TODO&type=BUG");

    loginAs(fx.manager);
    await expect(deleteFilterAction(f.id)).rejects.toThrow(
      "Можно удалять только свои фильтры"
    );

    loginAs(fx.member);
    await deleteFilterAction(f.id);
    expect(await prisma.savedFilter.findUnique({ where: { id: f.id } })).toBeNull();
  });

  it("посторонний не сохраняет фильтр в чужом проекте", async () => {
    loginAs(fx.outsider);
    await expect(
      saveFilterAction(fx.project.id, "Взлом", "status=DONE")
    ).rejects.toThrow("Нет доступа к проекту");
  });
});

describe("API-токены", () => {
  it("создаётся, авторизует Bearer, отзывается", async () => {
    loginAs(fx.member);
    const fd = new FormData();
    fd.set("name", "CI деплой");
    const res = await createApiTokenAction(undefined, fd);
    expect(res.token).toMatch(/^pl_/);

    const authed = await authenticateToken(`Bearer ${res.token}`);
    expect(authed?.id).toBe(fx.member.id);

    // Неверный токен — null
    expect(await authenticateToken("Bearer pl_wrong")).toBeNull();
    expect(await authenticateToken(null)).toBeNull();

    const tok = await prisma.apiToken.findFirstOrThrow({ where: { userId: fx.member.id } });
    await revokeApiTokenAction(tok.id);
    expect(await authenticateToken(`Bearer ${res.token}`)).toBeNull();
  });

  it("деактивированный пользователь не авторизуется токеном", async () => {
    loginAs(fx.member);
    const fd = new FormData();
    fd.set("name", "ноут");
    const { token } = await createApiTokenAction(undefined, fd);
    await prisma.user.update({ where: { id: fx.member.id }, data: { active: false } });
    expect(await authenticateToken(`Bearer ${token}`)).toBeNull();
  });
});

describe("project actions", () => {
  it("владельца исключить нельзя", async () => {
    loginAs(fx.manager);
    await expect(
      removeProjectMemberAction(fx.project.id, fx.owner.id)
    ).rejects.toThrow("Владельца проекта исключить нельзя");
  });

  it("разработчик не управляет составом, менеджер — управляет", async () => {
    loginAs(fx.member);
    await expect(
      removeProjectMemberAction(fx.project.id, fx.manager.id)
    ).rejects.toThrow("Требуются права менеджера проекта");

    loginAs(fx.manager);
    await removeProjectMemberAction(fx.project.id, fx.member.id);
    const left = await prisma.projectMember.findFirst({
      where: { projectId: fx.project.id, userId: fx.member.id },
    });
    expect(left).toBeNull();
  });

  it("архивирование — только менеджер+", async () => {
    loginAs(fx.member);
    await expect(toggleProjectArchiveAction(fx.project.id)).rejects.toThrow(
      "Требуются права менеджера проекта"
    );

    loginAs(fx.owner); // владелец с ролью разработчика — можно
    await toggleProjectArchiveAction(fx.project.id);
    const p = await prisma.project.findUniqueOrThrow({ where: { id: fx.project.id } });
    expect(p.status).toBe("ARCHIVED");
  });
});
