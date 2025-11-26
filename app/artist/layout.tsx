"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { createClient } from "@/utils/supabase/client";
import { useTheme } from "./hooks/useTheme";
import { useArtistRank } from "./hooks/useArtistRank";

const navItems = [
  {
    label: "Explore",
    href: "/artist/explore",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  },
  {
    label: "Works / Unreleased",
    href: "/artist/projects",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    ),
  },
  {
    label: "Dashboard",
    href: "/artist",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
];

export default function ArtistLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { data } = useArtistRank();

  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    async function checkAuth() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!active) return;
        if (!user) {
          setIsAuthenticated(false);
          router.replace("/login");
        } else {
          setIsAuthenticated(true);
          setUserEmail(user.email ?? null);
        }
      } catch (err) {
        console.warn("ArtistLayout auth check failed", err);
        router.replace("/login");
      } finally {
        if (active) setAuthChecked(true);
      }
    }
    checkAuth();
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    function handleOutside(ev: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(ev.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const artist = data?.artist;
  const artistName = artist?.artist_name || "Artist";
  const artistPhoto = artist?.artist_photo_url;

  async function handleLogout() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("Logout error", err);
    } finally {
      router.replace("/login");
    }
  }

  if (!authChecked || !isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--background)] text-[var(--text-primary)]">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--sidebar-bg)] px-4 py-3 text-sm text-[var(--text-muted)]">
          Verifico la sessione...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)] text-[var(--text-primary)] selection:bg-[var(--accent)] selection:text-black font-sans transition-colors">
      <aside className="relative z-30 flex h-full w-64 shrink-0 flex-col justify-between border-r border-[var(--border)] bg-[var(--sidebar-bg)]">
        <div>
          <div className="mb-3 flex items-center gap-3 px-4 pt-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border)] bg-black/80">
              <Image
                src="/icon.png"
                alt="Tekkin logo"
                width={40}
                height={40}
                className="h-9 w-9 object-contain"
                priority
              />
            </div>
            <span className="text-lg font-bold tracking-tight">TEKKIN</span>
          </div>

          <div className="mx-3 mb-6 flex items-center gap-2 rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--sidebar-bg)_90%,var(--border)_10%)] px-3 py-2 text-sm font-medium text-[var(--text-muted)] shadow-sm transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span>New Thread...</span>
            <span className="ml-auto rounded border border-[var(--border)] px-1.5 text-xs text-[var(--text-muted)]">⋯</span>
          </div>

          <nav className="space-y-1 px-3">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                    active
                      ? "border border-[var(--accent)]/30 bg-[color-mix(in_srgb,var(--sidebar-bg)_88%,var(--border)_12%)] text-[var(--text-primary)]"
                      : "text-[var(--text-muted)] hover:bg-[color-mix(in_srgb,var(--sidebar-bg)_88%,var(--border)_12%)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <span className="text-[var(--text-muted)]">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-[var(--border)] p-4">
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex w-full items-center gap-3 rounded-md px-2 py-2 hover:bg-[color-mix(in_srgb,var(--sidebar-bg)_88%,var(--border)_12%)] transition-colors"
            >
              <div className="h-9 w-9 overflow-hidden rounded-full bg-[var(--accent)] text-center font-bold text-black">
                {artistPhoto ? (
                  <img src={artistPhoto} alt={artistName} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-xs font-bold">
                    {artistName.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <div className="truncate text-sm font-medium text-[var(--text-primary)]">{artistName}</div>
                <div className="truncate text-xs text-[var(--text-muted)]">{userEmail || "Pro Account"}</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--text-muted)]">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {menuOpen && (
              <div className="absolute bottom-12 left-2 w-64 rounded-xl border border-[var(--border)] bg-[var(--sidebar-bg)] text-[var(--text-primary)] shadow-2xl">
                <div className="px-4 py-3">
                  <div className="text-sm font-semibold truncate">{artistName}</div>
                  <div className="text-xs text-[var(--text-muted)] truncate">
                    {userEmail || "email non disponibile"}
                  </div>
                  <div className="mt-3 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--sidebar-bg)_90%,var(--border)_10%)] px-2 py-1.5">
                    <button
                      onClick={() => theme === "dark" && toggleTheme()}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                        theme === "light" ? "bg-[var(--accent)] text-black" : "text-[var(--text-muted)]"
                      }`}
                      title="Light mode"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="4" />
                        <path d="M12 2v2m0 16v2m10-10h-2M4 12H2m15.5 6.5-1.5-1.5M8 8 6.5 6.5m0 11L8 16m8-8 1.5-1.5" />
                      </svg>
                    </button>
                    <button
                      onClick={() => theme === "light" && toggleTheme()}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                        theme === "dark" ? "bg-[var(--accent)] text-black" : "text-[var(--text-muted)]"
                      }`}
                      title="Dark mode"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                      </svg>
                    </button>
                    <button
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)]"
                      title="System theme"
                      disabled
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="14" rx="2" />
                        <path d="M7 20h10" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="border-t border-[var(--border)] text-sm">
                  {[
                    { label: "Manage cookies", href: "#" },
                    { label: "Terms & policies", href: "#" },
                    { label: "Help", href: "#" },
                  ].map((item) => (
                    <button
                      key={item.label}
                      className="flex w-full items-center px-4 py-2 text-left text-[var(--text-muted)] hover:bg-[color-mix(in_srgb,var(--sidebar-bg)_90%,var(--border)_10%)] hover:text-[var(--text-primary)] transition-colors"
                      onClick={() => setMenuOpen(false)}
                    >
                      {item.label}
                    </button>
                  ))}
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center px-4 py-2 text-left text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                  >
                    Log out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="relative min-w-0 flex-1 overflow-y-auto bg-[var(--background)] transition-colors">
        {children}
      </main>
    </div>
  );
}
