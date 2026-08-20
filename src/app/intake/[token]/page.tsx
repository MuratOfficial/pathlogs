import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { IntakeForm } from "@/components/IntakeForm";
import { AuthorLinks, DevelopedBy } from "@/components/AuthorCredits";

async function getForm(token: string) {
  return prisma.intakeForm.findFirst({
    where: { token, active: true },
    select: {
      token: true,
      title: true,
      hint: true,
      project: { select: { name: true } },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const form = await getForm(token);
  return {
    title: form ? `${form.title} — ${form.project.name}` : "Форма недоступна",
    // Форма заявок не должна попадать в поиск: ссылку раздают адресно
    robots: { index: false, follow: false },
  };
}

export default async function IntakePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const form = await getForm(token);
  // Закрытая форма неотличима от несуществующей — по ссылке ничего не узнать
  if (!form) notFound();

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-12">
      <div className="animate-fade-up rounded-2xl border border-edge bg-surface p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {form.project.name}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{form.title}</h1>
        <p className="mt-2 text-sm text-muted">
          {form.hint ??
            "Опишите задачу или проблему — мы получим заявку и свяжемся с вами по указанному контакту."}
        </p>
        <div className="mt-6">
          <IntakeForm token={form.token} />
        </div>
      </div>

      <footer className="mt-8 flex flex-col items-center gap-3">
        <p className="text-xs text-muted">Форма приёма заявок · PathLogs</p>
        <DevelopedBy />
        <AuthorLinks className="text-center" />
      </footer>
    </div>
  );
}
