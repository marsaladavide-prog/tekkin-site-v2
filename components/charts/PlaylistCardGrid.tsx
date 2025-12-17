import Link from "next/link";
import type { ReactNode } from "react";
import SoftButton from "@/components/ui/SoftButton";

type PlaylistCard = {
  id: string;
  title: string;
  description: string;
  href: string;
  image?: string | null;
  badge?: string;
};

export default function PlaylistCardGrid(props: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  actionHref?: string;
  cards: PlaylistCard[];
  footer?: ReactNode;
}) {
  return (
    <section className="rounded-3xl bg-white/5 ring-1 ring-white/10">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/8 px-5 py-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-white/55">{props.title}</div>
          {props.subtitle && <div className="mt-1 text-sm text-white/45">{props.subtitle}</div>}
        </div>

        {props.actionLabel && props.actionHref && (
          <Link href={props.actionHref}>
            <SoftButton variant="accent">{props.actionLabel}</SoftButton>
          </Link>
        )}
      </div>

      <div className="p-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {props.cards.map((c) => (
            <Link key={c.id} href={c.href} className="group">
              <div className="overflow-hidden rounded-2xl bg-black/15 ring-1 ring-white/10 transition group-hover:bg-black/25 group-hover:ring-white/15">
                <div className="aspect-[16/9] bg-white/5">
                  {c.image ? (
                    <img src={c.image} alt={c.title} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="h-full w-full bg-[radial-gradient(600px_200px_at_50%_0%,rgba(255,255,255,0.10),transparent_70%)]" />
                  )}
                </div>

                <div className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="truncate text-sm font-semibold text-white/80">{c.title}</div>
                    {c.badge && (
                      <span className="rounded-full bg-white/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-white/60 ring-1 ring-white/10">
                        {c.badge}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 line-clamp-2 text-sm text-white/45">{c.description}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {props.footer && <div className="mt-5">{props.footer}</div>}
      </div>
    </section>
  );
}
