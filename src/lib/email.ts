import nodemailer from "nodemailer";

/**
 * Отправка письма через SMTP. Конфигурация — из env (SMTP_HOST, SMTP_PORT,
 * SMTP_USER, SMTP_PASS, SMTP_FROM). Если SMTP не настроен — письмо логируется
 * в консоль (удобно для разработки), функция не падает.
 */
export async function sendMail(to: string, subject: string, html: string) {
  const host = process.env.SMTP_HOST;
  if (!host) {
    console.log(`[email] (SMTP не настроен) → ${to}: ${subject}`);
    return { delivered: false as const };
  }
  const transport = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_PORT === "465",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  await transport.sendMail({
    from: process.env.SMTP_FROM ?? "PathLogs <no-reply@pathlogs.local>",
    to,
    subject,
    html,
  });
  return { delivered: true as const };
}
