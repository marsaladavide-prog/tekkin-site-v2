// /app/news/ui/NewsGrid.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { NewsRow } from "@/types/news";
import { NewsCard } from "./NewsCard";
import { Button } from "@/components/ui/button";

type Props = { initialItems: NewsRow[] };

export function NewsGrid({ initialItems }: Props) {
  const [items, setItems] = useState<NewsRow[]>(initialItems);
  const [from, setFrom] = useState(initialItems.length);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const sentinel = useRef<HTMLDivElement | null>(null);

  const params = useMemo(() => {
    const form = document.getElementById("filters") as HTMLFormElement | null;
    const fd = new FormData(form ?? undefined);
    const q = (fd.get("q") as string) || "";
    const category = (fd.get("category") as string) || "";
    const source = (fd.get("source") as string) || "";
    return { q, category, source };
  }, []);

  async function loadMore() {
    if (loading) return;
    setLoading(true);
    const url = new URL("/api/news", window.location.origin);
    url.searchParams.set("from", String(from));
    url.searchParams.set("limit", "24");
    if (params.q) url.searchParams.set("q", params.q);
    if (params.category) url.searchParams.set("category", params.category);
    if (params.source) url.searchParams.set("source", params.source);
    const res = await fetch(url.toString(), { cache: "no-store" });
    const json = await res.json();
    if (json?.items?.length) {
      setItems(prev => [...prev, ...json.items]);
      setFrom(prev => prev + json.items.length);
      if (typeof json.total === "number") setTotal(json.total);
    } else {
      if (typeof json.total === "number") setTotal(json.total);
    }
    setLoading(false);
  }

  // auto load via IntersectionObserver
  useEffect(() => {
    if (!sentinel.current) return;
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) loadMore();
      });
    }, { rootMargin: "600px" });
    io.observe(sentinel.current);
    return () => io.disconnect();
  }, [sentinel.current]); // eslint-disable-line

  if (!items.length) {
    return <p className="text-sm text-muted-foreground">Nessuna notizia trovata.</p>;
  }

  const [featured, ...rest] = items;

  return (
    <>
      {/* Featured */}
      <article className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <NewsCard item={featured} featured />
        </div>
        <div className="flex flex-col gap-4">
          {rest.slice(0, 2).map(n => (
            <NewsCard key={n.id} item={n} compact />
          ))}
        </div>
      </article>

      {/* Masonry grid */}
      <section className="columns-1 gap-4 sm:columns-2 lg:columns-3 [column-fill:_balance]">
        {rest.slice(2).map(n => (
          <div key={n.id} className="mb-4 break-inside-avoid">
            <NewsCard item={n} />
          </div>
        ))}
      </section>

      {/* Load more manual fallback */}
      <div className="mt-6 flex items-center justify-center">
        <div ref={sentinel} />
        {total !== null && items.length >= total ? (
          <p className="text-xs text-muted-foreground">Hai visto tutto.</p>
        ) : (
          <Button onClick={loadMore} disabled={loading}>
            {loading ? "Carico..." : "Carica altri"}
          </Button>
        )}
      </div>
    </>
  );
}
