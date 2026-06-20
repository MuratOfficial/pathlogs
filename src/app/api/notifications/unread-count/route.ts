import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** Текущее число непрочитанных уведомлений — для живого счётчика в шапке. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  const count = await prisma.notification.count({
    where: { userId: session.user.id, read: false },
  });
  return NextResponse.json({ count });
}
