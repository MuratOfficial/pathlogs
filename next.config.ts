import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Импорт из Excel / MS Project передаёт файл в server action.
    // Дефолтный лимит тела (1 МБ) слишком мал для таких файлов.
    serverActions: {
      bodySizeLimit: "15mb",
    },
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
