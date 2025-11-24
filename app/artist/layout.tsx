"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
import { useTheme } from "./hooks/useTheme";

const navItems = [
  {
    label: "Explore",
    href: "/artist/explore",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
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
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
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
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
];

export default function ArtistLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)] text-[var(--text-primary)] selection:bg-[var(--accent)] selection:text-black font-sans transition-colors">
      <aside className="relative z-30 flex h-full w-64 shrink-0 flex-col justify-between border-r border-[var(--border)] bg-[var(--sidebar-bg)]">
        <div>
          <div className="mb-3 flex items-center gap-3 px-4 pt-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-tekkin-primary font-bold text-black">
              T
            </div>
            <span className="text-lg font-bold tracking-tight">TEKKIN</span>
          </div>

          <div className="mx-3 mb-3 flex items-center gap-2 rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--sidebar-bg)_90%,var(--border)_10%)] px-3 py-2 text-sm font-medium text-[var(--text-muted)] shadow-sm transition-colors">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span>New Thread...</span>
            <span className="ml-auto rounded border border-[var(--border)] px-1.5 text-xs text-[var(--text-muted)]">
              ⌘K
            </span>
          </div>

          <button
            onClick={toggleTheme}
            className="mx-3 mb-6 flex items-center gap-2 rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--sidebar-bg)_88%,var(--border)_12%)] px-3 py-2 text-sm font-medium text-[var(--text-muted)] shadow-sm transition-colors hover:border-[var(--accent)] hover:text-[var(--text-primary)]"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              {theme === "dark" ? (
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              ) : (
                <>
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2m0 16v2m10-10h-2M4 12H2m15.5 6.5-1.5-1.5M8 8 6.5 6.5m0 11L8 16m8-8 1.5-1.5" />
                </>
              )}
            </svg>
            <span>{theme === "dark" ? "Dark" : "Light"} mode</span>
          </button>

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
          <div className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-[color-mix(in_srgb,var(--sidebar-bg)_88%,var(--border)_12%)] transition-colors">
            <div className="h-9 w-9 overflow-hidden rounded-full bg-[var(--accent)] text-center font-bold text-black">
              <img
                src="https://ui-avatars.com/api/?name=Davide&background=06b6d4&color=000"
                alt="Davide"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-[var(--text-primary)]">
                Davide
              </div>
              <div className="truncate text-xs text-[var(--text-muted)]">
                Pro Account
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="relative min-w-0 flex-1 overflow-y-auto bg-[var(--background)] transition-colors">
        {children}
      </main>
    </div>
  );
}
