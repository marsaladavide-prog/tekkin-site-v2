import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SoftButton from "@/components/ui/SoftButton";

type AvatarItem = {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  href?: string;
  slug?: string | null;
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
                  <Image
                    src={artist.avatarUrl}
                    alt={artist.name ?? "Tekkin artist"}
                    fill
                    sizes="64px"
                    className="object-cover"
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

          if (artist.href) {
            return (
              <Link
                key={artist.id}
                href={artist.href}
                className="flex-shrink-0 rounded-2xl transition hover:brightness-110"
              >
                {content}
              </Link>
            );
          }

          const fallbackHref = artist.slug ? `/@${artist.slug}` : `/artist/discovery/${artist.id}`;

          return (
            <Link key={artist.id} href={fallbackHref} className="block">
              <div className="flex-shrink-0 rounded-2xl transition hover:brightness-110">
                {content}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// Inserisci questi log nel punto del file dove hai accesso a queste variabili (tipicamente in una pagina o componente che mostra l'artista pubblico):
console.log("[public-artist] artistRow", artistRow);
console.log("[public-artist] projectOwnerId", projectOwnerId);
console.log("[public-artist] projectIds", projectIds);
console.log("[public-artist] tracks len", tracks?.length ?? 0);
