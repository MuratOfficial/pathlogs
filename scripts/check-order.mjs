import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const tasks = await p.task.findMany({
  where: { project: { key: "PAY" } },
  select: { number: true, status: true, columnId: true, order: true },
  orderBy: [{ order: "asc" }],
});
console.log(JSON.stringify(tasks, null, 1));
await p.$disconnect();
