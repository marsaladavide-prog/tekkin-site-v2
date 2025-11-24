// /app/news/ui/NewsCard.tsx
"use client";

import type { NewsRow } from "@/types/news";
import { ExternalLink } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

function domainFrom(url: string) {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "";
  }
}

function fallbackImage(item: NewsRow) {
  const text = (item.source || domainFrom(item.url) || "Tekkin").slice(0, 2).toUpperCase();
  return `https://dummyimage.com/1200x630/0f0f0f/ffffff&text=${encodeURIComponent(text)}`;
}

export function NewsCard({
  item,
  featured = false,
  compact = false,
}: {
  item: NewsRow;
  featured?: boolean;
  compact?: boolean;
}) {
  const href = item.url;
  const tag = item.category || "news";
  const source = item.source || domainFrom(item.url);

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:shadow-md",
        featured && "h-full"
      )}
    >
      <div className={cn("relative w-full", featured ? "aspect-[16/8]" : compact ? "aspect-video" : "aspect-[4/3]")}>
        <Image
          src={item.image_url || fallbackImage(item)}
          alt={item.title}
          fill
          className="object-cover"
          sizes="(max-width:768px) 100vw, 50vw"
        />
        <span className="absolute left-3 top-3 rounded-full bg-black/70 px-2 py-1 text-xs font-medium text-white">
          {tag}
        </span>
      </div>

      <div className="p-4">
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">{source}</span>
          <span className="opacity-60">·</span>
          <time dateTime={item.created_at || ""}>
            {item.created_at ? new Date(item.created_at).toLocaleDateString() : ""}
          </time>
        </div>

        <h3 className={cn("line-clamp-2 font-semibold leading-snug", featured ? "text-xl" : "text-base")}>
          {item.title}
        </h3>

        {!compact && (
          <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
            {item.summary || ""}
          </p>
        )}

        <div className="mt-3">
          <Link
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium underline-offset-4 hover:underline"
          >
            Leggi l'articolo
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}
