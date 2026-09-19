import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter, JetBrains_Mono } from "next/font/google";
import { themeScript } from "@toimetdev/pathlogs-tokens";
import { skinScript } from "@/lib/skin";
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

// Шрифты скинов Linear и Railway. preload: false намеренно — иначе браузер
// тянул бы все четыре семейства каждому, а нужны те, что выбрал он сам.
// Пока скин не выбран, эти файлы не скачиваются вообще.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
  preload: false,
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin", "cyrillic"],
  preload: false,
});

export const metadata: Metadata = {
  title: "PathLogs",
  description:
    "Система управления проектами с ветвлением задач, канбаном и патч-логами",
  appleWebApp: { capable: true, title: "PathLogs", statusBarStyle: "default" },
};

// Цвет обвязки браузера до гидратации: фон оформления по умолчанию. Дальше
// его подхватывает ThemeColorMeta — иначе под другим скином или светлой темой
// полоса состояния осталась бы тёмно-синей.
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
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript() }} />
        <script dangerouslySetInnerHTML={{ __html: skinScript() }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegister />
        <ThemeColorMeta />
        {children}
      </body>
    </html>
  );
}
