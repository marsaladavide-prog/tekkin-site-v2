"use client";

export function InstagramFeed() {
  return (
    <section className="mt-12 mb-20 border-t border-[var(--border-color)] pt-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-mono font-semibold text-zinc-500 dark:text-tekkin-muted uppercase tracking-widest">
          Instagram Feed{" "}
          <span className="text-[9px] opacity-50 ml-2">[API CONNECTION: PENDING]</span>
        </h3>
        <a href="#" className="text-[10px] text-tekkin-primary hover:underline">
          @davidemarsala_
        </a>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-4 gap-2 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
        <div className="aspect-square bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md animate-pulse"></div>
        <div className="aspect-square bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md animate-pulse delay-75"></div>
        <div className="aspect-square bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md animate-pulse delay-150"></div>
        <div className="aspect-square bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md animate-pulse delay-200"></div>
      </div>
    </section>
  );
}
