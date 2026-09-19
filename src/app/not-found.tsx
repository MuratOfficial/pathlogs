import type { Metadata } from "next";
import { ErrorScreen } from "@/components/ErrorScreen";

export const metadata: Metadata = {
  title: "Страница не найдена — PathLogs",
  // Ошибочным адресам в поиске делать нечего
  robots: { index: false, follow: false },
};

/**
 * 404: и для несуществующих адресов, и для notFound() из страниц — например,
 * когда проект закрыт для этого пользователя или форма заявок выключена.
 * Формулировка нарочно не уточняет, что именно из этого произошло: по ссылке
 * с чужим токеном не должно быть видно, существует ли она вообще.
 */
export default function NotFound() {
  return (
    <ErrorScreen
      code="404"
      title="Такой страницы нет"
      description="Адрес набран с опечаткой, страницу удалили — или она доступна не вашей учётной записи. Проверьте ссылку или вернитесь к своим проектам."
    />
  );
}
