"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import SoftButton from "@/components/ui/SoftButton";

type AvatarItem = {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  slug?: string;
  href?: string;
};

type AvatarRailProps = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  actionHref?: string;
  items: AvatarItem[];
};

const placeholderColors = ["from-sky-500/80", "from-orange-500/80", "from-indigo-500/80", "from-emerald-500/80"];

function getInitials(name: string | null) {
  if (!name) return "TK";
  return name
    .split(" ")
    .map((part) => part.at(0) ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function AvatarRail({ title, subtitle, actionLabel, actionHref, items }: AvatarRailProps) {
  const router = useRouter();
  const handleAction = () => {
    if (!actionHref) return;
    router.push(actionHref);
  };

  const itemsArray = Array.isArray(items) ? items : [];

  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-soft-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[var(--muted)]">Top Artists</p>
          <h2 className="text-2xl font-semibold text-[var(--text)]">{title}</h2>
          {subtitle && <p className="text-sm text-[var(--muted)]">{subtitle}</p>}
        </div>
        {actionLabel && actionHref ? (
          <SoftButton variant="accent" onClick={handleAction}>
            {actionLabel}
          </SoftButton>
        ) : null}
      </div>

      <div className="mt-6 flex gap-6 overflow-x-auto pb-2">
        {itemsArray.length === 0 && (
          <p className="text-sm text-[var(--muted)]">Artisti non disponibili al momento</p>
        )}
        {itemsArray.map((artist, index) => {
          const color = placeholderColors[index % placeholderColors.length];
          const content = (
            <div className="flex flex-col items-center gap-2 text-center">
              <div className={`relative h-16 w-16 overflow-hidden rounded-full bg-gradient-to-br ${color} to-[var(--panel)]`}>
                {artist.avatarUrl ? (
                  <img
                    src={artist.avatarUrl}
                    alt={artist.name ?? "Tekkin artist"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-semibold uppercase tracking-[0.3em] text-white">
                    {getInitials(artist.name)}
                  </div>
                )}
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--muted)]">
                {artist.name ?? "Artist"}
              </p>
            </div>
          );

          // Sostituisci il wrapper:
          return artist.slug ? (
            <Link
              key={artist.id}
              href={`/@${artist.slug}`}
              className="block shrink-0"
            >
              {content}
            </Link>
          ) : (
            <div key={artist.id} className="flex-shrink-0">
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
}
