"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Layers, Radar, User } from "lucide-react";
import SoftButton from "@/components/ui/SoftButton";
import SidebarNavItem from "@/components/ui/SidebarNavItem";
import { useTheme } from "@/app/artist/hooks/useTheme";
import { useArtistRank } from "@/components/artist/hooks/useArtistRank";

const navItems = [
  { label: "Artist", href: "/artist", icon: User },
  { label: "Projects", href: "/artist/projects", icon: Layers, nested: true },
  { label: "Discovery", href: "/artist/discovery", icon: Radar },
  { label: "Charts", href: "/charts", icon: BarChart3 },
];

export default function ArtistSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { data } = useArtistRank();

  const artist = data?.artist;
  const artistName = artist?.artist_name ?? "Artist";
  const artistPhoto = artist?.artist_photo_url ?? null;
  const rankLabel =
    typeof data?.rank?.tekkin_score === "number"
      ? `Tekkin ${Math.round(data.rank.tekkin_score)}`
      : "Tekkin artist";

  const handleCreate = () => {
    router.push("/artist/projects?new=1");
  };

  const isActive = (href: string) => {
    if (href === "/artist") {
      return pathname === "/artist";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <aside className="w-64 shrink-0 border-r border-[var(--border)] bg-[var(--sidebar-bg)]">
      <div className="sticky top-0 flex h-screen flex-col justify-between gap-6 overflow-y-auto px-4 py-6">
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image
                src="/icon.png"
                alt="Tekkin logo"
                width={36}
                height={36}
                className="h-9 w-9 object-contain"
              />
              <span className="text-lg font-semibold tracking-[0.3em] text-[var(--text)]">
                TEKKIN
              </span>
            </div>
            <SoftButton
              variant="accent"
              className="h-10 w-10 rounded-full p-0 text-xl font-bold tracking-[0.2em]"
              aria-label="Upload new track"
              onClick={handleCreate}
            >
              +
            </SoftButton>
          </div>

          <nav className="space-y-1 text-sm">
            {navItems.map((item) => (
              <SidebarNavItem
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                active={isActive(item.href)}
                nested={item.nested}
              />
            ))}
          </nav>
        </div>

        <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 overflow-hidden rounded-full bg-[var(--accent)]">
              {artistPhoto ? (
                <img src={artistPhoto} alt={artistName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs font-semibold uppercase tracking-[0.3em] text-black">
                  {artistName.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--text)]">{artistName}</p>
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">{rankLabel}</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <button
              type="button"
              className={`flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] transition ${
                theme === "light" ? "bg-[var(--accent)] text-black" : "hover:border-[var(--accent)]"
              }`}
              onClick={() => toggleTheme()}
              aria-label="Toggle theme"
            >
              {theme === "light" ? "ƒ~?" : "ĐYOT"}
            </button>
            <button
              type="button"
              className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--muted)]"
              onClick={() => router.push("/artist/settings/profile")}
            >
              Profile
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
