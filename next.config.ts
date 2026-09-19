import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Импорт из Excel / MS Project передаёт файл в server action.
    // Дефолтный лимит тела (1 МБ) слишком мал для таких файлов.
    serverActions: {
      bodySizeLimit: "15mb",
    },
    // Раз в проекте есть proxy.ts, Next буферизует тело каждого запроса с этим
    // лимитом (по умолчанию 10 МБ). Тело сверх лимита не отвергается, а молча
    // обрезается — вложение уехало бы в хранилище битым, а файл импорта
    // распарсился бы мусором, и никто бы не узнал. Держим выше самого большого
    // тела, которое принимает приложение: 25 МБ в /api/upload плюс запас на
    // служебные байты multipart.
    proxyClientMaxBodySize: "26mb",
  },
  async headers() {
    return [
      {
        // SW не должен кэшироваться браузером — иначе обновления не доедут
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
