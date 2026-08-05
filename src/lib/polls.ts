import { prisma } from "@/lib/prisma";
import { isManager, type SessionUser } from "@/lib/access";
import type { PollDTO } from "@/lib/types";

/**
 * Опросы проекта с результатами глазами текущего пользователя.
 * У анонимных опросов список проголосовавших не отдаётся клиенту вовсе.
 */
export async function getProjectPolls(
  projectId: string,
  user: SessionUser
): Promise<PollDTO[]> {
  const [polls, project] = await Promise.all([
    prisma.poll.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { id: true, name: true } },
        options: {
          orderBy: { order: "asc" },
          include: {
            votes: { include: { user: { select: { id: true, name: true } } } },
          },
        },
      },
    }),
    prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { ownerId: true },
    }),
  ]);

  const managerHere = project.ownerId === user.id || isManager(user);

  return polls.map((p) => {
    const voters = new Set<string>();
    for (const o of p.options) for (const v of o.votes) voters.add(v.userId);
    return {
      id: p.id,
      question: p.question,
      description: p.description,
      multiple: p.multiple,
      anonymous: p.anonymous,
      closed: p.closedAt !== null,
      author: { id: p.author.id, name: p.author.name },
      createdAt: p.createdAt.toISOString(),
      options: p.options.map((o) => ({
        id: o.id,
        text: o.text,
        votes: o.votes.length,
        voters: p.anonymous ? [] : o.votes.map((v) => v.user),
        chosenByMe: o.votes.some((v) => v.userId === user.id),
      })),
      voterCount: voters.size,
      canManage: p.authorId === user.id || managerHere,
    };
  });
}
