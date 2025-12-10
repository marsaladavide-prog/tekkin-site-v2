// /app/news/page.tsx
import { supabaseServer } from "@/lib/supabaseServer";
import { NewsGrid } from "./ui/NewsGrid";
import { Suspense } from "react";
import { Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

async function getInitial(filters: { q?: string; category?: string; source?: string }) {
  const supabase = await supabaseServer();
  let query = supabase
    .from("news")
    .select("id,title,slug,url,source,category,summary,created_at,image_url", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .limit(25);

  if (filters.q) {
    const term = `%${filters.q}%`;
    query = query.or(`title.ilike.${term},summary.ilike.${term}`);
  }
  if (filters.category) {
    query = query.eq("category", filters.category);
  }
  if (filters.source) {
    query = query.ilike("source", `%${filters.source}%`);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { items: data || [], total: count ?? null };
}

type NewsPageSearchParams = {
  q?: string;
  category?: string;
  source?: string;
};

export default async function NewsPage({
  searchParams,
}: {
  // ⬅ qui: searchParams come Promise, compatibile col PageProps di Next
  searchParams?: Promise<NewsPageSearchParams>;
}) {
  const resolved = (await searchParams) ?? {};

  const filters = {
    q: (resolved.q || "").trim(),
    category: (resolved.category || "").trim(),
    source: (resolved.source || "").trim(),
  };

  const initial = await getInitial(filters);

  return (
    <main className="min-h-screen">
      <section className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">News & Tips</h1>
            <p className="text-sm text-muted-foreground">
              Magazine Tekkin. Produzione, promo, eventi, strumenti, update. Tutto in un unico feed.
            </p>
          </div>

          <form
            id="filters"
            className="flex w-full max-w-2xl items-center gap-2"
            method="get"
            action="/news"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 opacity-60" />
              <Input
                name="q"
                placeholder="Cerca titoli o contenuti"
                className="pl-9"
                defaultValue={filters.q}
              />
            </div>
            <select
              name="category"
              className="h-10 rounded-md border bg-background px-3 text-sm"
              defaultValue={filters.category}
            >
              <option value="">Tutte le categorie</option>
              <option value="production">Production</option>
              <option value="promotion">Promotion</option>
              <option value="events">Events</option>
              <option value="news">News</option>
              <option value="tips">Tips</option>
            </select>
            <Input
              name="source"
              placeholder="Sorgente"
              className="w-32"
              defaultValue={filters.source}
            />
            <Button type="submit" variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              Filtra
            </Button>
          </form>
        </header>

        <Suspense fallback={<div className="h-40 w-full animate-pulse rounded-2xl bg-muted" />}>
          <NewsGrid
            initialItems={initial.items}
            initialTotal={initial.total}
            initialParams={filters}
          />
        </Suspense>
      </section>
    </main>
  );
}
