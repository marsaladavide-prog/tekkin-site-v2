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

        <div className="space-y-4">
          {/* Artist Profile Card - Professional Design */}
          <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-black/40 via-black/30 to-black/50 p-5 shadow-2xl backdrop-blur-sm transition-all duration-300 hover:shadow-[0_0_30px_rgba(34,211,238,0.15)] hover:border-cyan-400/20">
            {/* Background glow effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400/5 via-transparent to-cyan-400/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            {/* Content */}
            <div className="relative">
              {/* Artist Avatar & Info */}
              <div className="flex items-center gap-4 mb-4">
                <div className="relative">
                  {/* Avatar with glow */}
                  <div className="h-12 w-12 overflow-hidden rounded-full border-2 border-cyan-400/30 shadow-lg shadow-cyan-400/20">
                    {artistPhoto ? (
                      <img
                        src={artistPhoto}
                        alt={artistName}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-cyan-400/20 to-cyan-300/10 text-sm font-bold uppercase tracking-[0.2em] text-cyan-300">
                        {artistName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  {/* Online indicator */}
                  <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 border-2 border-black shadow-sm" />
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-white truncate">{artistName}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    <span className="text-xs font-medium text-cyan-300 uppercase tracking-[0.1em]">
                      {rankLabel}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition-all duration-200 hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-cyan-300"
                  onClick={() => toggleTheme()}
                  aria-label="Toggle theme"
                  title={theme === "light" ? "Switch to Dark" : "Switch to Light"}
                >
                  <span className="text-xs font-bold">
                    {theme === "light" ? "☀️" : "🌙"}
                  </span>
                </button>

                <button
                  type="button"
                  className="flex-1 h-8 rounded-lg border border-white/10 bg-white/5 text-xs font-medium text-white/70 transition-all duration-200 hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-cyan-300"
                  onClick={() => router.push("/artist/settings/profile")}
                >
                  Edit Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
