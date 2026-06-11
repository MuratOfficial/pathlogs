import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("demo1234", 12);

  const [admin, manager, analyst, dev] = await Promise.all(
    [
      { email: "admin@pathlogs.dev", name: "Алексей Админов", role: "ADMIN" },
      { email: "manager@pathlogs.dev", name: "Мария Менеджерова", role: "MANAGER" },
      { email: "analyst@pathlogs.dev", name: "Анна Аналитикова", role: "ANALYST" },
      { email: "dev@pathlogs.dev", name: "Дмитрий Разработчиков", role: "DEVELOPER" },
    ].map((u) =>
      prisma.user.upsert({
        where: { email: u.email },
        update: {},
        create: { ...u, passwordHash: password },
      })
    )
  );

  const existing = await prisma.project.findUnique({ where: { key: "PAY" } });
  if (existing) {
    console.log("Демо-проект уже существует, пропускаем");
    return;
  }

  const project = await prisma.project.create({
    data: {
      key: "PAY",
      name: "Платёжный сервис",
      description: "Демо-проект: интеграция платёжного шлюза с личным кабинетом",
      ownerId: admin.id,
      members: {
        create: [admin, manager, analyst, dev].map((u) => ({ userId: u.id })),
      },
    },
  });

  const mkTask = (data) =>
    prisma.task.create({ data: { projectId: project.id, creatorId: manager.id, ...data } });

  const epic = await mkTask({
    title: "Интеграция платёжного шлюза",
    description: "Корневая задача: подключить эквайринг, провести аналитику и выкатить в прод.",
    type: "MANAGEMENT",
    priority: "HIGH",
    status: "IN_PROGRESS",
    assignees: { connect: [{ id: manager.id }] },
    estimateHours: 120,
  });

  const research = await mkTask({
    title: "Анализ платёжных провайдеров",
    description: "Сравнить Stripe, ЮKassa и CloudPayments по комиссиям и SLA.",
    type: "ANALYTICS",
    priority: "HIGH",
    status: "DONE",
    parentId: epic.id,
    assignees: { connect: [{ id: analyst.id }] },
    estimateHours: 16,
    closedAt: new Date(),
  });

  const api = await mkTask({
    title: "API эндпоинты оплаты",
    description: "POST /payments, вебхуки статусов, идемпотентность.",
    type: "FEATURE",
    priority: "CRITICAL",
    status: "IN_PROGRESS",
    parentId: epic.id,
    assignees: { connect: [{ id: dev.id }] },
    estimateHours: 40,
  });

  const webhooks = await mkTask({
    title: "Обработка вебхуков провайдера",
    type: "FEATURE",
    priority: "HIGH",
    status: "TODO",
    parentId: api.id,
    assignees: { connect: [{ id: dev.id }] },
    estimateHours: 12,
  });

  const idempotency = await mkTask({
    title: "Идемпотентность запросов",
    type: "FEATURE",
    priority: "MEDIUM",
    status: "REVIEW",
    parentId: api.id,
    assignees: { connect: [{ id: dev.id }] },
    estimateHours: 8,
  });

  const ui = await mkTask({
    title: "Экран оплаты в личном кабинете",
    type: "DESIGN",
    priority: "MEDIUM",
    status: "TODO",
    parentId: epic.id,
    assignees: { connect: [{ id: dev.id }, { id: manager.id }] },
    estimateHours: 24,
  });

  const bug = await mkTask({
    title: "Двойное списание при ретрае",
    description: "При повторной отправке формы создаются два платежа.",
    type: "BUG",
    priority: "CRITICAL",
    status: "TODO",
    parentId: api.id,
    assignees: { connect: [{ id: dev.id }] },
    estimateHours: 4,
  });

  await prisma.taskLink.createMany({
    data: [
      { fromId: bug.id, toId: idempotency.id, type: "BLOCKS" },
      { fromId: ui.id, toId: api.id, type: "RELATES" },
      { fromId: webhooks.id, toId: research.id, type: "RELATES" },
    ],
  });

  await prisma.patchLog.createMany({
    data: [
      {
        taskId: research.id,
        authorId: analyst.id,
        title: "Итоги сравнения провайдеров",
        content:
          "Сравнила трёх провайдеров по 12 критериям.\nВыбор: ЮKassa — комиссия 2.8%, вебхуки с подписью, песочница.\nОтчёт приложен к задаче.",
      },
      {
        taskId: api.id,
        authorId: dev.id,
        title: "Реализован POST /payments",
        content:
          "Создание платежа через SDK провайдера.\n- Валидация суммы и валюты (zod)\n- Сохранение в таблицу payments со статусом PENDING\n- Редирект на платёжную форму\nТесты: 14 кейсов, все зелёные.",
      },
      {
        taskId: idempotency.id,
        authorId: dev.id,
        title: "Idempotency-Key через Redis-подобный кеш",
        content:
          "Ключ идемпотентности хранится 24 часа, повторный запрос возвращает исходный ответ. Покрыто интеграционными тестами.",
      },
    ],
  });

  await prisma.timeEntry.createMany({
    data: [
      { taskId: research.id, userId: analyst.id, hours: 14, note: "Сравнительная таблица" },
      { taskId: api.id, userId: dev.id, hours: 18.5, note: "Эндпоинт + тесты" },
      { taskId: idempotency.id, userId: dev.id, hours: 6, note: "Реализация и ревью" },
      { taskId: epic.id, userId: manager.id, hours: 5, note: "Координация, созвоны" },
    ],
  });

  console.log("Демо-данные созданы.");
  console.log("Логин: admin@pathlogs.dev / demo1234 (а также manager@, analyst@, dev@)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
