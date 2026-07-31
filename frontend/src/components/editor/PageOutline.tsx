import { useEffect, useMemo, useState } from "react";

export type PageOutlineItem = {
  id: string;
  level: 1 | 2 | 3;
  title: string;
};

type PageOutlineProps = {
  items: PageOutlineItem[];
};

export function PageOutline({ items }: PageOutlineProps) {
  const visibleItems = useMemo(() => items.filter((item) => item.title.trim()), [items]);
  const [activeId, setActiveId] = useState<string | null>(visibleItems[0]?.id ?? null);

  useEffect(() => {
    setActiveId((current) => (current && visibleItems.some((item) => item.id === current) ? current : visibleItems[0]?.id ?? null));
  }, [visibleItems]);

  useEffect(() => {
    if (!visibleItems.length) return;

    const root = document.querySelector(".app-main");
    const observer = new IntersectionObserver(
      (entries) => {
        const closest = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => Math.abs(left.boundingClientRect.top - 96) - Math.abs(right.boundingClientRect.top - 96))[0];
        const blockId = closest?.target.getAttribute("data-block-id");
        if (blockId) setActiveId(blockId);
      },
      {
        root,
        rootMargin: "-96px 0px -62% 0px",
        threshold: [0, 0.1, 1]
      }
    );

    visibleItems.forEach((item) => {
      const target = document.getElementById(`block-${item.id}`);
      if (target) observer.observe(target);
    });

    return () => observer.disconnect();
  }, [visibleItems]);

  if (!visibleItems.length) return null;

  const scrollToBlock = (blockId: string) => {
    document.getElementById(`block-${blockId}`)?.scrollIntoView({ block: "start", behavior: "smooth" });
    setActiveId(blockId);
  };

  return (
    <aside className="page-outline" aria-label="Page outline">
      <div className="page-outline-rail" aria-hidden="true">
        {visibleItems.map((item) => (
          <span key={item.id} className={`page-outline-dash level-${item.level} ${activeId === item.id ? "active" : ""}`} />
        ))}
      </div>
      <nav className="page-outline-panel">
        {visibleItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`page-outline-link level-${item.level} ${activeId === item.id ? "active" : ""}`}
            onClick={() => scrollToBlock(item.id)}
          >
            {item.title}
          </button>
        ))}
      </nav>
    </aside>
  );
}
