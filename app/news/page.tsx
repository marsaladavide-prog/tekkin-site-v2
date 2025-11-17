// /app/news/page.tsx
import { supabaseServer } from "@/lib/supabaseServer";
import { NewsGrid } from "./ui/NewsGrid";
import { Suspense } from "react";
import { Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

async function getInitial() {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("news")
    .select("id,title,slug,url,source,category,summary,created_at,image_url")
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) throw new Error(error.message);
  return data || [];
}

export default async function NewsPage() {
  const initial = await getInitial();

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

          <form id="filters" className="flex w-full max-w-xl items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 opacity-60" />
              <Input name="q" placeholder="Cerca titoli o contenuti" className="pl-9" />
            </div>
            <select name="category" className="h-10 rounded-md border bg-background px-3 text-sm">
              <option value="">Tutte le categorie</option>
              <option value="production">Production</option>
              <option value="promotion">Promotion</option>
              <option value="events">Events</option>
              <option value="news">News</option>
              <option value="tips">Tips</option>
            </select>
            <Input name="source" placeholder="Sorgente" className="w-32" />
            <Button type="submit" variant="outline">
  <Filter className="mr-2 h-4 w-4" />
  Filtra
</Button>
          </form>
        </header>

        <Suspense fallback={<div className="h-40 w-full animate-pulse rounded-2xl bg-muted" />}>
          <NewsGrid initialItems={initial} />
        </Suspense>
      </section>
    </main>
  );
}
