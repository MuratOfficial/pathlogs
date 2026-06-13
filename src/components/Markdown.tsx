import type { ReactNode } from "react";

/**
 * Ограниченный Markdown без зависимостей. Рендерит в React-элементы —
 * сырой HTML невозможен по построению (всё экранируется React).
 *
 * Поддерживается: **жирный**, *курсив*, ~~зачёркнутый~~, `код`,
 * ```блоки кода```, [ссылки](https://…) (только http/https/mailto),
 * заголовки #…### (размеры ограничены, чтобы не ломать вёрстку),
 * списки -/* и 1., цитаты >, горизонтальная черта ---.
 * Картинки и raw-HTML не поддерживаются намеренно.
 */

const SAFE_PROTOCOLS = /^(https?:\/\/|mailto:)/i;

/** Инлайн-разметка: код, ссылки, жирный, курсив, зачёркнутый. */
function renderInline(text: string, keyBase = 0): ReactNode[] {
  const out: ReactNode[] = [];
  // Порядок важен: код раньше остального, ** раньше *
  const re =
    /(`[^`\n]+`)|(\[([^\]\n]+)\]\(([^)\s]+)\))|(\*\*([^*\n]+)\*\*)|(__([^_\n]+)__)|(\*([^*\n]+)\*)|(_([^_\n]+)_)|(~~([^~\n]+)~~)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = keyBase;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) {
      out.push(
        <code key={k++} className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.85em] text-accent-hover">
          {m[1].slice(1, -1)}
        </code>
      );
    } else if (m[2]) {
      const label = m[3]!;
      const href = m[4]!;
      if (SAFE_PROTOCOLS.test(href)) {
        out.push(
          <a
            key={k++}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-hover underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
          >
            {renderInline(label, k * 100)}
          </a>
        );
      } else {
        out.push(m[2]); // небезопасный протокол — оставляем как текст
      }
    } else if (m[5] || m[7]) {
      out.push(<strong key={k++}>{renderInline((m[6] ?? m[8])!, k * 100)}</strong>);
    } else if (m[9] || m[11]) {
      out.push(<em key={k++}>{renderInline((m[10] ?? m[12])!, k * 100)}</em>);
    } else if (m[13]) {
      out.push(<del key={k++}>{renderInline(m[14]!, k * 100)}</del>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Разбивает текст по @упоминаниям известных имён, остальное — обычная инлайн-разметка. */
function renderWithMentions(text: string, mentions: string[]): ReactNode[] {
  const escaped = mentions
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (escaped.length === 0) return renderInline(text);
  const re = new RegExp(`@(?:${escaped.join("|")})`, "g");
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(...renderInline(text.slice(last, m.index), k++ * 1000));
    out.push(
      <span
        key={`mention-${k++}`}
        className="rounded bg-accent/15 px-1 font-medium text-accent-hover"
      >
        {m[0]}
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(...renderInline(text.slice(last), k++ * 1000));
  return out;
}

/** Только инлайн-разметка (для пунктов чек-листа, заголовков и т.п.). */
export function MarkdownInline({ text, mentions }: { text: string; mentions?: string[] }) {
  return <>{mentions?.length ? renderWithMentions(text, mentions) : renderInline(text)}</>;
}

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "h"; level: number; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "quote"; lines: string[] }
  | { kind: "code"; lines: string[] }
  | { kind: "hr" };

function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.trim().startsWith("```")) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.trim().startsWith("```")) body.push(lines[i++]!);
      i++; // закрывающая ```
      blocks.push({ kind: "code", lines: body });
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      blocks.push({ kind: "h", level: Math.min(h[1]!.length, 3), text: h[2]! });
      i++;
      continue;
    }
    if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) {
      blocks.push({ kind: "hr" });
      i++;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\s*\d+[.)]\s+/, ""));
        i++;
      }
      blocks.push({ kind: "ol", items });
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i]!)) {
        body.push(lines[i]!.replace(/^\s*>\s?/, ""));
        i++;
      }
      blocks.push({ kind: "quote", lines: body });
      continue;
    }
    const body: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() &&
      !/^(#{1,6}\s|```|\s*[-*]\s|\s*\d+[.)]\s|\s*>)/.test(lines[i]!)
    ) {
      body.push(lines[i]!);
      i++;
    }
    blocks.push({ kind: "p", lines: body });
  }
  return blocks;
}

// Размеры заголовков ограничены, чтобы пользовательский текст не ломал вёрстку
const HEADING_CLS: Record<number, string> = {
  1: "text-base font-bold",
  2: "text-[15px] font-bold",
  3: "text-sm font-semibold",
};

/** Блочный Markdown для описаний задач, патч-логов и комментариев. */
export function Markdown({
  text,
  className = "",
  mentions,
}: {
  text: string;
  className?: string;
  /** Имена для подсветки @упоминаний (участники проекта). */
  mentions?: string[];
}) {
  const blocks = parseBlocks(text);
  return (
    <div className={`space-y-2 text-sm text-foreground/85 ${className}`}>
      {blocks.map((b, idx) => {
        switch (b.kind) {
          case "h":
            return (
              <p key={idx} className={`${HEADING_CLS[b.level]} text-foreground`}>
                <MarkdownInline text={b.text} mentions={mentions} />
              </p>
            );
          case "hr":
            return <hr key={idx} className="border-edge" />;
          case "code":
            return (
              <pre
                key={idx}
                className="overflow-x-auto rounded-lg border border-edge bg-surface-2 p-3 font-mono text-xs leading-relaxed"
              >
                {b.lines.join("\n")}
              </pre>
            );
          case "ul":
            return (
              <ul key={idx} className="list-disc space-y-1 pl-5">
                {b.items.map((it, j) => (
                  <li key={j}>
                    <MarkdownInline text={it} mentions={mentions} />
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={idx} className="list-decimal space-y-1 pl-5">
                {b.items.map((it, j) => (
                  <li key={j}>
                    <MarkdownInline text={it} mentions={mentions} />
                  </li>
                ))}
              </ol>
            );
          case "quote":
            return (
              <blockquote
                key={idx}
                className="border-l-2 border-accent/50 pl-3 text-muted"
              >
                {b.lines.map((l, j) => (
                  <p key={j}>
                    <MarkdownInline text={l} mentions={mentions} />
                  </p>
                ))}
              </blockquote>
            );
          case "p":
            return (
              <p key={idx} className="whitespace-pre-wrap">
                {b.lines.map((l, j) => (
                  <span key={j}>
                    {j > 0 && "\n"}
                    <MarkdownInline text={l} mentions={mentions} />
                  </span>
                ))}
              </p>
            );
        }
      })}
    </div>
  );
}
