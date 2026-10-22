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

// Хранилище подменяем: проверяем учёт вложений в БД, а не запись на диск.
// vi.hoisted — потому что vi.mock поднимается выше объявлений модуля.
const { deleteStoredFiles } = vi.hoisted(() => ({
  deleteStoredFiles: vi.fn(async () => {}),
}));
vi.mock("@/lib/storage", () => ({ deleteStoredFiles }));

import { prisma } from "@/lib/prisma";
import { DRAFT_TTL_MS, fileEmbed } from "@/lib/attachments";
import {
  bindDraftAttachments,
  purgeStaleDraftAttachments,
} from "@/lib/draftAttachments";
import { createTaskAction } from "@/lib/actions/tasks";
import { loginAs } from "./auth-state";
import { createFixtures, resetDb, type Fixtures } from "./fixtures";

let f: Fixtures;

beforeEach(async () => {
  await resetDb();
  f = await createFixtures();
  deleteStoredFiles.mockClear();
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** Черновик: файл загружен в форме создания, задачи у него ещё нет. */
function makeDraft(opts: {
  projectId: string | null;
  uploadedById: string;
  taskId?: string;
  createdAt?: Date;
}) {
  return prisma.attachment.create({
    data: {
      filename: "макет.png",
      key: `key-${Math.random().toString(36).slice(2)}`,
      url: "/api/files/key",
      size: 1024,
      mime: "image/png",
      storage: "LOCAL",
      projectId: opts.projectId,
      taskId: opts.taskId,
      uploadedById: opts.uploadedById,
      ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
    },
  });
}

describe("bindDraftAttachments", () => {
  it("привязывает свой черновик того же проекта", async () => {
    const draft = await makeDraft({
      projectId: f.project.id,
      uploadedById: f.member.id,
    });

    const count = await bindDraftAttachments({
      ids: [draft.id],
      taskId: f.task.id,
      projectId: f.project.id,
      userId: f.member.id,
    });

    expect(count).toBe(1);
    const after = await prisma.attachment.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(after.taskId).toBe(f.task.id);
  });

  it("чужой черновик не переезжает в задачу", async () => {
    const foreign = await makeDraft({
      projectId: f.project.id,
      uploadedById: f.owner.id,
    });

    const count = await bindDraftAttachments({
      ids: [foreign.id],
      taskId: f.task.id,
      projectId: f.project.id,
      userId: f.member.id,
    });

    expect(count).toBe(0);
    const after = await prisma.attachment.findUniqueOrThrow({
      where: { id: foreign.id },
    });
    expect(after.taskId).toBeNull();
  });

  it("черновик другого проекта не привязывается", async () => {
    const elsewhere = await makeDraft({
      projectId: f.otherProject.id,
      uploadedById: f.member.id,
    });

    const count = await bindDraftAttachments({
      ids: [elsewhere.id],
      taskId: f.task.id,
      projectId: f.project.id,
      userId: f.member.id,
    });

    expect(count).toBe(0);
  });

  it("уже привязанный файл не отбирается у своей задачи", async () => {
    const bound = await makeDraft({
      projectId: f.project.id,
      uploadedById: f.member.id,
      taskId: f.otherTask.id,
    });

    const count = await bindDraftAttachments({
      ids: [bound.id],
      taskId: f.task.id,
      projectId: f.project.id,
      userId: f.member.id,
    });

    expect(count).toBe(0);
    const after = await prisma.attachment.findUniqueOrThrow({
      where: { id: bound.id },
    });
    expect(after.taskId).toBe(f.otherTask.id);
  });
});

describe("createTaskAction с вложениями", () => {
  it("прикладывает черновики к созданной задаче", async () => {
    loginAs(f.member);
    const draft = await makeDraft({
      projectId: f.project.id,
      uploadedById: f.member.id,
    });

    const fd = new FormData();
    fd.set("title", "Задача с макетом");
    fd.set("projectId", f.project.id);
    fd.set("type", "FEATURE");
    fd.set("priority", "MEDIUM");
    // В описании — вставка того же файла: id в тексте и id вложения совпадают,
    // поэтому превью находится сразу после создания.
    fd.set("description", `Вот макет:\n\n${fileEmbed(draft.id)}`);
    fd.append("attachmentIds", draft.id);

    const res = await createTaskAction(undefined, fd);
    expect(res.error).toBeUndefined();
    expect(res.taskId).toBeTruthy();

    const after = await prisma.attachment.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(after.taskId).toBe(res.taskId);
    const task = await prisma.task.findUniqueOrThrow({
      where: { id: res.taskId! },
    });
    expect(task.description).toContain(fileEmbed(draft.id));
  });

  it("чужой id в форме ничего не прикладывает", async () => {
    loginAs(f.member);
    const foreign = await makeDraft({
      projectId: f.project.id,
      uploadedById: f.owner.id,
    });

    const fd = new FormData();
    fd.set("title", "Задача без файлов");
    fd.set("projectId", f.project.id);
    fd.set("type", "FEATURE");
    fd.set("priority", "MEDIUM");
    fd.append("attachmentIds", foreign.id);

    const res = await createTaskAction(undefined, fd);
    expect(res.error).toBeUndefined();

    const attached = await prisma.attachment.count({
      where: { taskId: res.taskId! },
    });
    expect(attached).toBe(0);
  });
});

describe("purgeStaleDraftAttachments", () => {
  it("убирает брошенные черновики и оставляет свежие", async () => {
    const old = await makeDraft({
      projectId: f.project.id,
      uploadedById: f.member.id,
      createdAt: new Date(Date.now() - DRAFT_TTL_MS - 60_000),
    });
    const recent = await makeDraft({
      projectId: f.project.id,
      uploadedById: f.member.id,
    });
    const bound = await makeDraft({
      projectId: f.project.id,
      uploadedById: f.member.id,
      taskId: f.task.id,
      createdAt: new Date(Date.now() - DRAFT_TTL_MS - 60_000),
    });

    const removed = await purgeStaleDraftAttachments();

    expect(removed).toBe(1);
    expect(await prisma.attachment.findUnique({ where: { id: old.id } })).toBeNull();
    expect(
      await prisma.attachment.findUnique({ where: { id: recent.id } })
    ).not.toBeNull();
    expect(
      await prisma.attachment.findUnique({ where: { id: bound.id } })
    ).not.toBeNull();
    // Сам файл тоже убирается из хранилища, иначе он вечно занимает квоту
    expect(deleteStoredFiles).toHaveBeenCalledWith([
      expect.objectContaining({ id: old.id }),
    ]);
  });

  it("без черновиков ничего не трогает", async () => {
    expect(await purgeStaleDraftAttachments()).toBe(0);
    expect(deleteStoredFiles).not.toHaveBeenCalled();
  });
});
