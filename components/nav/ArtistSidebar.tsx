"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Cpu,
  Layers,
  Moon,
  Radar,
  Search,
  Settings,
  Signal,
  Sun,
  User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";

import SoftButton from "@/components/ui/SoftButton";
import SidebarNavItem from "@/components/ui/SidebarNavItem";
import { useTheme } from "@/app/artist/hooks/useTheme";
import { useArtistRank } from "@/components/artist/hooks/useArtistRank";
import NotificationsBell from "@/components/notifications/NotificationsBell";

type NavGroup = {
  label: string;
  icon: LucideIcon;
  items: Array<{ label: string; href: string; icon: LucideIcon }>;
};

const navGroups: NavGroup[] = [
  {
    label: "Artist",
    icon: User,
    items: [
      { label: "Projects", href: "/artist/projects", icon: Layers },
      { label: "Signals", href: "/artist/signals", icon: Signal },
    ],
  },
  {
    label: "Discovery",
    icon: Radar,
    items: [
      { label: "Circuit", href: "/discovery", icon: Cpu },
      { label: "Scanner", href: "/artist/discovery/scanner", icon: Search },
    ],
  },
];

const soloLinks = [{ label: "Charts", href: "/charts", icon: BarChart3 }];

export default function ArtistSidebar() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { data } = useArtistRank();
  const [profileOpen, setProfileOpen] = useState(false);

  const artist = data?.artist;
  const artistName = artist?.artist_name?.trim() || "Artist";
  const artistPhoto = artist?.artist_photo_url ?? null;
  const tekkinScore =
    typeof data?.rank?.tekkin_score === "number"
      ? Math.round(data.rank.tekkin_score)
      : null;

  const initials =
    artistName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((segment) => segment[0])
      .join("")
      .toUpperCase() || "AR";

  const hasPhoto = !!(artistPhoto && artistPhoto.startsWith("http"));

  const handleCreate = () => {
    router.push("/artist/projects?new=1");
  };

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="sticky top-0 h-screen w-64 shrink-0 border-r border-[var(--border)] bg-[var(--sidebar-bg)]">
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-y-auto px-4 py-6">
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

            <nav className="space-y-6 text-sm">
              {navGroups.map((group) => {
                const GroupIcon = group.icon;
                return (
                  <div key={group.label} className="space-y-2">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/60">
                      <GroupIcon className="h-4 w-4 text-white/50" aria-hidden />
                      <span>{group.label}</span>
                    </div>
                    <div className="space-y-1">
                      {group.items.map((item) => (
                        <SidebarNavItem
                          key={item.href}
                          href={item.href}
                          label={item.label}
                          icon={item.icon}
                          nested
                          active={isActive(item.href)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}

              <div className="space-y-1 pt-2">
                {soloLinks.map((item) => (
                  <SidebarNavItem
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    active={isActive(item.href)}
                  />
                ))}
              </div>
            </nav>
          </div>
        </div>

        <div className="px-4 pb-6">
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-black/40 p-2.5 shadow-[0_12px_24px_rgba(0,0,0,0.35)]">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setProfileOpen((prev) => !prev)}
                  className="flex flex-1 items-center gap-3 rounded-xl px-2 py-1.5 text-left transition hover:bg-white/5"
                  aria-expanded={profileOpen}
                >
                  <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-gradient-to-br from-cyan-500/30 to-blue-900/40">
                    {hasPhoto ? (
                      <Image
                        src={artistPhoto!}
                        alt={artistName}
                        width={44}
                        height={44}
                        className="h-full w-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-200">
                        {initials}
                      </div>
                    )}
                    <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border border-black bg-emerald-400" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{artistName}</p>
                    <p className="mt-1 text-[11px] text-white/55">Pro Account</p>
                  </div>
                </button>

                <Link
                  href="/artist/notifications"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-transparent text-white/70 transition hover:border-cyan-400/40 hover:bg-white/5 hover:text-white"
                  aria-label="Notifiche"
                >
                  <NotificationsBell />
                </Link>
              </div>

              {profileOpen && (
                <div className="mt-2 rounded-xl border border-white/10 bg-black/60 p-2">
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between rounded-lg px-2 py-1.5 text-[11px] uppercase tracking-[0.24em] text-white/60">
                      <span>Tekkin</span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-white/80">
                        {tekkinScore ?? "??"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg px-2 py-1.5 text-[11px] uppercase tracking-[0.24em] text-white/60">
                      <span>Stato</span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-white/80">
                        Attivo
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 border-t border-white/10 pt-2">
                    <div className="space-y-1">
                      <Link
                        href="/artist/notifications"
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/5 hover:text-white"
                      >
                        <NotificationsBell />
                        Notifiche
                      </Link>
                      <Link
                        href="/artist/settings"
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/5 hover:text-white"
                      >
                        <Settings className="h-4 w-4" />
                        Impostazioni
                      </Link>
                      <button
                        type="button"
                        onClick={toggleTheme}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/5 hover:text-white"
                      >
                        {theme === "dark" ? (
                          <Sun className="h-4 w-4 text-amber-200" />
                        ) : (
                          <Moon className="h-4 w-4 text-slate-400" />
                        )}
                        Tema {theme === "dark" ? "Scuro" : "Chiaro"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
