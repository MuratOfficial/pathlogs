"use client";

import { useEffect } from "react";

/**
 * Регистрирует service worker для PWA (установка на устройство + офлайн-кэш).
 * Только в production: в dev SW кэшировал бы _next-чанки и ломал HMR.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => {
          /* регистрация необязательна — приложение работает и без SW */
        });
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
