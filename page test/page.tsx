"use client";

import React, { useMemo, useState } from "react";
import { Search, ArrowRight, Play, Pause, Grid3X3, List } from "lucide-react";

type LibraryItem = {
  id: string;
  code: string; // tipo ENDZ058
  artist: string;
  title: string;
  duration: string;
  genre: string;
  status: "DRAFT" | "IN PROGRESS" | "READY";
};

function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-black/10 bg-black/5 px-2.5 py-1 text-xs font-semibold text-black/70">
      {children}
    </span>
  );
}

function RedButton({
  children,
  onClick,
  variant = "outline",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "outline" | "solid";
}) {
  const cls =
    variant === "solid"
      ? "bg-red-600 text-white hover:bg-red-700"
      : "border border-red-500/60 text-red-600 hover:bg-red-50";

  return (
    <button
      onClick={onClick}
      className={cx(
        "inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-extrabold tracking-wide transition",
        cls
      )}
    >
      {children}
    </button>
  );
}

function RecordCover({ tone = "teal" }: { tone?: "teal" | "gray" | "yellow" | "blue" }) {
  const bg =
    tone === "teal"
      ? "from-teal-700 to-teal-300"
      : tone === "yellow"
        ? "from-yellow-500 to-yellow-200"
        : tone === "blue"
          ? "from-sky-700 to-sky-300"
          : "from-zinc-600 to-zinc-300";

  return (
    <div className="relative mx-auto h-[220px] w-[220px] rounded-full bg-gradient-to-br shadow-sm">
      <div className="absolute inset-0 rounded-full ring-1 ring-black/10" />
      <div className="absolute left-1/2 top-1/2 h-[70px] w-[70px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white ring-1 ring-black/10" />
      <div className="absolute left-1/2 top-1/2 h-[10px] w-[10px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/60" />
    </div>
  );
}

export default function TekkinLibraryModePreview() {
  const [q, setQ] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [playingId, setPlayingId] = useState<string | null>(null);

  const items: LibraryItem[] = useMemo(
    () => [
      { id: "1", code: "TKK001", artist: "Davide Marsala", title: "gora", duration: "6:12", genre: "Minimal / Deep Tech", status: "IN PROGRESS" },
      { id: "2", code: "TKK002", artist: "Davide Marsala", title: "yaam", duration: "5:32", genre: "Minimal / Deep Tech", status: "READY" },
      { id: "3", code: "TKK003", artist: "Davide Marsala", title: "ad", duration: "7:05", genre: "Minimal Deep", status: "DRAFT" },
    ],
    []
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((it) => (it.code + " " + it.artist + " " + it.title + " " + it.genre).toLowerCase().includes(s));
  }, [q, items]);

  return (
    <div className="min-h-screen bg-white text-black">
      {/* top bar */}
      <div className="sticky top-0 z-20 border-b border-black/10 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-black text-white font-black">T</div>
            <div>
              <div className="text-sm font-extrabold tracking-wide">TEKKIN</div>
              <div className="text-xs text-black/50">Library</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search"
                className="h-10 w-[280px] rounded-full border border-black/10 bg-white px-10 text-sm outline-none focus:border-black/20"
              />
            </div>

            <button
              onClick={() => setView("grid")}
              className={cx(
                "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-black/10",
                view === "grid" ? "bg-black text-white" : "bg-white"
              )}
              title="Grid"
            >
              <Grid3X3 className="h-4 w-4" />
            </button>

            <button
              onClick={() => setView("list")}
              className={cx(
                "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-black/10",
                view === "list" ? "bg-black text-white" : "bg-white"
              )}
              title="List"
            >
              <List className="h-4 w-4" />
            </button>

            <RedButton variant="solid">
              Open Workspace
              <ArrowRight className="ml-2 h-4 w-4" />
            </RedButton>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8 space-y-2 text-black/80">
          <div className="text-[11px] uppercase tracking-[0.3em] text-black/40">Library</div>
          <h1 className="text-3xl font-black tracking-tight text-black">Library</h1>
          <p className="text-sm text-black/60 max-w-2xl">
            Browse tracks like a catalog. Then open a project to analyze, version and share.
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs tracking-wide">
            <span className="text-black/60">{filtered.length} items</span>
            <span className="text-black/45">Minimal / Deep Tech</span>
          </div>
        </div>

        {view === "grid" ? (
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((it, idx) => {
              const isPlaying = playingId === it.id;
              const tone = idx % 3 === 0 ? "teal" : idx % 3 === 1 ? "gray" : "yellow";
              return (
                <div key={it.id} className="text-center">
                  <RecordCover tone={tone as any} />

                  <div className="mt-6 text-2xl font-black tracking-tight">{it.code}</div>
                  <div className="mt-2 text-sm font-semibold text-black/70">{it.artist}</div>
                  <div className="mt-1 text-sm text-black/55">
                    {it.title} · {it.duration}
                  </div>

                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <Pill>{it.genre}</Pill>
                    <Pill>{it.status}</Pill>
                  </div>

                  <div className="mt-6 flex items-center justify-center gap-3">
                    <RedButton
                      onClick={() => setPlayingId((cur) => (cur === it.id ? null : it.id))}
                      variant="outline"
                    >
                      {isPlaying ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                      {isPlaying ? "PAUSE" : "LISTEN NOW"}
                    </RedButton>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="divide-y divide-black/10 rounded-2xl border border-black/10">
            {filtered.map((it) => {
              const isPlaying = playingId === it.id;
              return (
                <div key={it.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-black">{it.code}</div>
                      <Pill>{it.status}</Pill>
                      <Pill>{it.genre}</Pill>
                    </div>
                    <div className="mt-1 text-sm text-black/70">
                      <span className="font-semibold">{it.artist}</span>
                      <span className="text-black/30"> | </span>
                      {it.title} · {it.duration}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <RedButton
                      onClick={() => setPlayingId((cur) => (cur === it.id ? null : it.id))}
                      variant="outline"
                    >
                      {isPlaying ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                      LISTEN NOW
                    </RedButton>
                    <RedButton variant="solid">
                      Open
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </RedButton>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-12 border-t border-black/10 pt-10 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-black/5 px-5 py-2 text-sm font-semibold text-black/70">
            TEKKIN
          </div>
          <div className="mt-4 text-xs text-black/50">
            Library mode preview. Workspace mode stays dark glass for analysis and versions.
          </div>
        </div>
      </div>
    </div>
  );
}
