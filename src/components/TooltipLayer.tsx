"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type TipState = {
  text: string;
  x: number; // центр якоря по горизонтали
  y: number; // точка привязки по вертикали (верх или низ якоря)
  placement: "top" | "bottom";
};

const MAX_W = 220; // должно совпадать с max-width баблов ниже
const GAP = 8;

/**
 * Один глобальный тултип на всё приложение. Слушает наведение/фокус на
 * любом элементе с непустым data-tip и рендерит бабл через портал в <body>
 * с position: fixed — поэтому он НЕ обрезается контейнерами с overflow
 * (колонки канбана, прокручиваемые списки) и всегда виден целиком.
 */
export function TooltipLayer() {
  const [tip, setTip] = useState<TipState | null>(null);

  useEffect(() => {
    let current: HTMLElement | null = null;

    function show(el: HTMLElement) {
      const text = el.getAttribute("data-tip");
      if (!text) return;
      const r = el.getBoundingClientRect();
      // По умолчанию — над элементом; если сверху мало места, показываем снизу
      const placement: "top" | "bottom" = r.top < 56 ? "bottom" : "top";
      current = el;
      setTip({
        text,
        x: r.left + r.width / 2,
        y: placement === "top" ? r.top - GAP : r.bottom + GAP,
        placement,
      });
    }

    function hide(el?: EventTarget | null) {
      if (el && el !== current) return;
      current = null;
      setTip(null);
    }

    function onOver(e: Event) {
      const el = (e.target as HTMLElement)?.closest?.("[data-tip]") as HTMLElement | null;
      if (el?.getAttribute("data-tip")) show(el);
    }

    function onOut(e: Event) {
      const el = (e.target as HTMLElement)?.closest?.("[data-tip]") as HTMLElement | null;
      if (!el || el !== current) return;
      // Переход на дочерний элемент того же якоря не должен скрывать тултип
      const related = (e as MouseEvent).relatedTarget as Node | null;
      if (related && el.contains(related)) return;
      hide(el);
    }

    // Позиции fixed устаревают при прокрутке/ресайзе — просто прячем
    function onScrollOrResize() {
      hide(current);
    }

    // Доступность: нативный title читался скринридерами, а data-tip — нет.
    // Для иконочных элементов (без видимого текста и без своего aria-label)
    // дублируем data-tip в aria-label. Элементы с текстом не трогаем —
    // их доступным именем уже служит видимый текст.
    function labelOne(el: Element) {
      const tip = el.getAttribute("data-tip");
      if (!tip || el.hasAttribute("aria-label")) return;
      if ((el.textContent ?? "").trim() !== "") return;
      el.setAttribute("aria-label", tip);
    }
    function labelTree(root: Element) {
      if (root.matches?.("[data-tip]")) labelOne(root);
      root.querySelectorAll?.("[data-tip]").forEach(labelOne);
    }
    labelTree(document.body);
    // Карточки/колонки появляются динамически — навешиваем на новые узлы
    const observer = new MutationObserver((records) => {
      for (const rec of records) {
        rec.addedNodes.forEach((n) => {
          if (n.nodeType === 1) labelTree(n as Element);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    document.addEventListener("focusin", onOver);
    document.addEventListener("focusout", onOut);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      document.removeEventListener("focusin", onOver);
      document.removeEventListener("focusout", onOut);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      observer.disconnect();
    };
  }, []);

  if (!tip) return null;

  // Удерживаем бабл в пределах вьюпорта по горизонтали.
  // Если ширина вьюпорта почему-то недоступна — клампить не пытаемся,
  // иначе тултип уехал бы за экран.
  const half = MAX_W / 2;
  const vw = window.innerWidth || document.documentElement.clientWidth || 0;
  const x = vw > MAX_W ? Math.min(Math.max(tip.x, half + 6), vw - half - 6) : tip.x;

  return createPortal(
    <div
      role="tooltip"
      style={{
        position: "fixed",
        left: x,
        top: tip.y,
        transform: `translate(-50%, ${tip.placement === "top" ? "-100%" : "0"})`,
        maxWidth: MAX_W,
        pointerEvents: "none",
        zIndex: 90,
      }}
      className="animate-fade-in rounded-[0.55rem] border border-edge bg-surface-2 px-2.5 py-1.5 text-center text-xs font-medium leading-snug text-foreground shadow-xl"
    >
      {tip.text}
    </div>,
    document.body
  );
}
