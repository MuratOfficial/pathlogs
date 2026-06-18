import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Импорт из Excel / MS Project передаёт файл в server action.
    // Дефолтный лимит тела (1 МБ) слишком мал для таких файлов.
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
