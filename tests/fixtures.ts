import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "User","Project","ProjectMember","BoardColumn","Task","TaskLink","PatchLog","TimeEntry","Attachment","ChecklistItem","Comment","Notification" RESTART IDENTITY CASCADE'
  );
}

function createUser(email: string, name: string, role: Role) {
  return prisma.user.create({
    data: { email, name, role, passwordHash: "test-hash" },
  });
}

/**
 * Базовый набор: проект TST (владелец — разработчик `owner`; участники — owner,
 * manager, member) и чужой проект OTH (владелец admin, участников нет).
 */
export async function createFixtures() {
  const admin = await createUser("admin@test.dev", "Админ", "ADMIN");
  // Владелец нарочно с ролью DEVELOPER — проверяем права владельца, а не роли
  const owner = await createUser("owner@test.dev", "Владелец", "DEVELOPER");
  const manager = await createUser("manager@test.dev", "Менеджер", "MANAGER");
  const member = await createUser("member@test.dev", "Участник", "DEVELOPER");
  // Менеджер по роли, но не участник проекта
  const outsider = await createUser("outsider@test.dev", "Посторонний", "MANAGER");

  const project = await prisma.project.create({
    data: {
      key: "TST",
      name: "Тестовый проект",
      ownerId: owner.id,
      members: {
        create: [
          { userId: owner.id },
          { userId: manager.id },
          { userId: member.id },
        ],
      },
      columns: {
        create: [
          { name: "К выполнению", status: "TODO", color: "#94a3b8", order: 10 },
          { name: "В работе", status: "IN_PROGRESS", color: "#60a5fa", order: 20 },
          { name: "Кастомная", color: "#f59e0b", order: 30 },
        ],
      },
    },
    include: { columns: true },
  });

  const otherProject = await prisma.project.create({
    data: {
      key: "OTH",
      name: "Чужой проект",
      ownerId: admin.id,
      members: { create: [{ userId: admin.id }] },
      columns: {
        create: [{ name: "К выполнению", status: "TODO", color: "#94a3b8", order: 10 }],
      },
    },
    include: { columns: true },
  });

  const task = await prisma.task.create({
    data: { title: "Задача участника", projectId: project.id, creatorId: member.id },
  });
  const otherTask = await prisma.task.create({
    data: {
      title: "Задача чужого проекта",
      projectId: otherProject.id,
      creatorId: admin.id,
    },
  });

  return {
    admin,
    owner,
    manager,
    member,
    outsider,
    project,
    otherProject,
    task,
    otherTask,
    cols: {
      todo: project.columns.find((c) => c.status === "TODO")!,
      inProgress: project.columns.find((c) => c.status === "IN_PROGRESS")!,
      custom: project.columns.find((c) => c.status === null)!,
      otherTodo: otherProject.columns[0]!,
    },
  };
}

export type Fixtures = Awaited<ReturnType<typeof createFixtures>>;
