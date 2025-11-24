"use client";

import { useEffect, useState } from "react";

type Row = {
  title: string;
  artist: string;
  status: { label: string; badgeClass: string };
  version: string;
  bpmKey: string;
  date: string;
  artworkUrl: string;
  active?: boolean;
};

const rows: Row[] = [
  {
    title: "Eternit",
    artist: "Davide Marsala",
    status: { label: "MASTER READY", badgeClass: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" },
    version: "v3.1",
    bpmKey: "128 / Fm",
    date: "2 hours ago",
    artworkUrl: "https://ui-avatars.com/api/?name=E&background=000&color=fff",
    active: true,
  },
  {
    title: "CONTRT",
    artist: "Tekkin",
    status: { label: "SIGNED", badgeClass: "bg-purple-500/10 text-purple-400 border border-purple-500/20" },
    version: "Final",
    bpmKey: "126 / Gm",
    date: "5 days ago",
    artworkUrl: "https://ui-avatars.com/api/?name=C&background=111&color=555",
  },
  {
    title: "Untitled Idea 04",
    artist: "Demo",
    status: { label: "DEMO", badgeClass: "bg-amber-500/10 text-amber-400 border border-amber-500/20" },
    version: "v1.0",
    bpmKey: "-- / --",
    date: "1 week ago",
    artworkUrl: "https://ui-avatars.com/api/?name=U&background=222&color=eee",
  },
];

export default function ProjectsPage() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const toggleTheme = () => {
    const html = document.documentElement;
    const nowDark = !html.classList.contains("dark");
    html.classList.toggle("dark");
    setIsDark(nowDark);
  };

  return (
    <div className="flex-1 relative overflow-y-auto bg-tekkin-bg text-white selection:bg-[#06b6d4] selection:text-black">
      <div className="absolute top-6 right-6 z-50">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-full bg-white dark:bg-[var(--card-bg)] border border-[var(--border-color)] text-zinc-700 dark:text-[var(--text-color)] hover:border-tekkin-primary transition-colors shadow-md"
        >
          <svg
            className={isDark ? "w-5 h-5 block" : "w-5 h-5 hidden"}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
            ></path>
          </svg>
          <svg
            className={isDark ? "w-5 h-5 hidden" : "w-5 h-5 block"}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
            ></path>
          </svg>
        </button>
      </div>

      <div className="fixed inset-0 bg-grid-pattern pointer-events-none opacity-[0.03]" />

      <div className="min-h-full flex justify-center p-8 md:p-10">
        <div className="w-full max-w-6xl relative space-y-6">
          <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.16em] text-[var(--text-muted)] mb-1">
                Works / Library
              </p>
              <h1 className="text-2xl md:text-3xl font-black text-[var(--text-color)]">
                Projects
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search tracks, BPM, tags..."
                className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded px-3 py-2 text-sm text-[var(--text-color)] w-64 focus:border-tekkin-primary focus:outline-none transition-colors"
              />
              <button className="flex items-center gap-2 px-4 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-color)] text-sm font-medium rounded hover:border-tekkin-primary transition-colors">
                Import
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-tekkin-primary hover:bg-tekkin-accent text-black text-sm font-bold rounded-full shadow-[0_0_12px_rgba(6,182,212,0.3)] transition-colors">
                New Project
              </button>
            </div>
          </header>

          <div className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-white dark:bg-[var(--card-bg)] shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[var(--sidebar-bg)] text-xs font-mono text-[var(--text-muted)] uppercase tracking-[0.12em]">
                  <tr>
                    <th className="px-6 py-3 border-b border-[var(--border-color)] w-12">
                      #
                    </th>
                    <th className="px-6 py-3 border-b border-[var(--border-color)] w-96">
                      Track Name
                    </th>
                    <th className="px-6 py-3 border-b border-[var(--border-color)]">
                      Status
                    </th>
                    <th className="px-6 py-3 border-b border-[var(--border-color)]">
                      Version
                    </th>
                    <th className="px-6 py-3 border-b border-[var(--border-color)] text-right">
                      BPM / Key
                    </th>
                    <th className="px-6 py-3 border-b border-[var(--border-color)] text-right">
                      Date
                    </th>
                    <th className="px-6 py-3 border-b border-[var(--border-color)] text-right">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="text-sm divide-y divide-[var(--border-color)]">
                  {rows.map((row, idx) => (
                    <tr
                      key={row.title + idx}
                      className={`group hover:bg-[var(--sidebar-bg)] transition-colors ${
                        row.active ? "bg-[var(--sidebar-bg)]/60" : ""
                      }`}
                    >
                      <td className="px-6 py-4 text-[var(--text-muted)]">
                        {row.active ? (
                          <svg className="w-4 h-4 text-tekkin-primary" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        ) : (
                          (idx + 1).toString().padStart(2, "0")
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded overflow-hidden border border-[var(--border-color)] bg-black">
                            <img src={row.artworkUrl} className="w-full h-full object-cover" alt={row.title} />
                          </div>
                          <div>
                            <div className="font-bold text-[var(--text-color)] group-hover:text-tekkin-primary">
                              {row.title}
                            </div>
                            <div className="text-xs text-[var(--text-muted)] font-mono">{row.artist}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-mono ${row.status.badgeClass}`}>
                          {row.status.label}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <span className="font-mono text-[var(--text-muted)]">{row.version}</span>
                      </td>

                      <td className="px-6 py-4 text-right font-mono text-[var(--text-muted)]">{row.bpmKey}</td>

                      <td className="px-6 py-4 text-right text-[var(--text-muted)] text-xs">{row.date}</td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="text-[var(--text-muted)] hover:text-[var(--text-color)]">Play</button>
                          <button className="text-[var(--text-muted)] hover:text-[var(--text-color)]">Share</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
