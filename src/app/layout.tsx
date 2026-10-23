import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { themeScript } from "@toimetdev/pathlogs-tokens";
import { sidebarScript } from "@/lib/sidebar";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { ThemeColorMeta } from "@/components/ThemeColorMeta";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "PathLogs",
  description:
    "Система управления проектами с ветвлением задач, канбаном и патч-логами",
  appleWebApp: { capable: true, title: "PathLogs", statusBarStyle: "default" },
};

// Цвет обвязки браузера до гидратации: фон оформления по умолчанию. Дальше
// его подхватывает ThemeColorMeta — иначе в светлой теме полоса состояния
// осталась бы тёмно-синей.
export const viewport: Viewport = {
  themeColor: "#0b0f1a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript() }} />
        <script dangerouslySetInnerHTML={{ __html: sidebarScript() }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegister />
        <ThemeColorMeta />
        {children}
      </body>
    </html>
  );
}
