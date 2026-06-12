/** Лейаут печатных страниц: белый фон без навигации приложения. */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex-1 bg-white">{children}</div>;
}
