import { formatDate } from "@/lib/labels";

export type Commit = {
  id: string;
  sha: string;
  message: string | null;
  url: string | null;
  author: string | null;
  filesChanged: number | null;
  committedAt: Date | null;
  createdAt: Date;
};

/** Панель git-коммитов задачи (заполняется через POST /api/git/webhook). */
export function GitCommits({ commits }: { commits: Commit[] }) {
  return (
    <ul className="space-y-2">
      {commits.map((c) => {
        const title = (c.message ?? "").split("\n")[0] || c.sha.slice(0, 7);
        const date = c.committedAt ?? c.createdAt;
        const meta = [
          c.author,
          c.filesChanged != null ? `${c.filesChanged} файл.` : null,
          formatDate(date),
        ].filter(Boolean);
        const Row = (
          <div className="flex items-start gap-2.5 rounded-xl border border-edge bg-surface-2/40 p-3 transition hover:border-accent/50">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-accent-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 3v12m0 0a3 3 0 103 3m-3-3a3 3 0 013 3m6-12a3 3 0 10-3-3m3 3v6a3 3 0 01-3 3" />
            </svg>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="shrink-0 rounded bg-surface px-1.5 py-0.5 font-mono text-[11px] font-semibold text-muted">
                  {c.sha.slice(0, 7)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{title}</span>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted">{meta.join(" · ")}</p>
            </div>
          </div>
        );
        return (
          <li key={c.id}>
            {c.url ? (
              <a href={c.url} target="_blank" rel="noopener noreferrer">
                {Row}
              </a>
            ) : (
              Row
            )}
          </li>
        );
      })}
    </ul>
  );
}
