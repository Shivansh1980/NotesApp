import { Clock3, FileText, Plus } from "lucide-react";

import type { PageTreeNode } from "../../types/page.types";

type HomeViewProps = {
  pages: PageTreeNode[];
  onSelectPage: (pageId: string) => void;
  onCreatePage: () => void;
};

function flattenPages(pages: PageTreeNode[]): PageTreeNode[] {
  return pages.flatMap((page) => [page, ...flattenPages(page.children)]);
}

function formatEditedAt(value: string): string {
  const timestamp = new Date(value);
  const now = Date.now();
  const elapsed = Math.max(0, now - timestamp.getTime());
  const minutes = Math.floor(elapsed / 60_000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return timestamp.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: timestamp.getFullYear() === new Date().getFullYear() ? undefined : "numeric"
  });
}

export function HomeView({ pages, onSelectPage, onCreatePage }: HomeViewProps) {
  const recentPages = flattenPages(pages)
    .sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime())
    .slice(0, 12);

  return (
    <main className="home-view">
      <header className="home-view-header">
        <div>
          <h1>Home</h1>
          <p>Pick up where you left off.</p>
        </div>
        <button className="primary-button" type="button" onClick={onCreatePage}>
          <Plus size={17} />
          New page
        </button>
      </header>

      <section className="home-section" aria-labelledby="recent-pages-heading">
        <div className="home-section-heading">
          <Clock3 size={16} />
          <h2 id="recent-pages-heading">Recently visited</h2>
        </div>

        {recentPages.length ? (
          <div className="home-page-list">
            {recentPages.map((page) => (
              <button key={page.id} type="button" onClick={() => onSelectPage(page.id)}>
                <span className="home-page-icon" aria-hidden="true">
                  {page.icon || <FileText size={19} />}
                </span>
                <span className="home-page-copy">
                  <strong>{page.title || "Untitled"}</strong>
                  <span>Edited {formatEditedAt(page.updated_at)}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="home-empty-state">
            <FileText size={24} />
            <strong>No pages yet</strong>
            <span>Create your first page to start writing.</span>
          </div>
        )}
      </section>
    </main>
  );
}
