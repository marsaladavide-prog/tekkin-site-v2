"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Radio, Heart, ListMusic, Search, Settings2, Bell } from "lucide-react";
import { useTekkinPlayer } from "@/lib/player/useTekkinPlayer";
import TrackTable from "./TrackTable";
import type { ChartSnapshotEntry } from "./types";

type ChartRow = {
  project_id: string;
  version_id?: string | null;
  track_title: string | null;
  artist_name: string | null;
  artist_id?: string | null;
  cover_url: string | null;
  audio_url: string | null;
  mix_type: string | null;
  rank_position: number;
  score_public: number | null;
};

function safeText(v: unknown, fallback: string) {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function CoverFallback({ label }: { label: string }) {
  return (
    <div className="grid h-full w-full place-items-center bg-gradient-to-br from-white/10 via-white/5 to-transparent">
      <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/55">{label}</span>
    </div>
  );
}

function AvatarFallback({ label }: { label: string }) {
  return (
    <div className="grid h-full w-full place-items-center bg-gradient-to-br from-white/10 via-white/5 to-transparent">
      <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/55">{label}</span>
    </div>
  );
}

export default function ChartsReferenceLayout(props: {
  periodStart: string | null;
  periodEnd: string | null;
  globalSnapshots: ChartRow[];
  qualitySnapshots: ChartRow[];
}) {
  const open = useTekkinPlayer((s) => s.open);

  const topArtists = useMemo(() => {
    const map = new Map<string, { name: string; image?: string | null }>();
    for (const r of props.globalSnapshots) {
      const id = r.artist_id ?? r.artist_name ?? "unknown";
      if (map.has(id)) continue;
      map.set(id, {
        name: safeText(r.artist_name, "Unknown Artist"),
        image: r.cover_url ?? null,
      });
      if (map.size >= 10) break;
    }
    return Array.from(map.entries()).map(([id, v]) => ({ id, ...v }));
  }, [props.globalSnapshots]);

  const recently = useMemo(() => props.globalSnapshots.slice(0, 4), [props.globalSnapshots]);

  const periodLabel = `Periodo ${props.periodStart ?? "?"} - ${props.periodEnd ?? "?"}`;

  return (
    <main className="min-h-screen bg-[#06070a] px-6 py-8">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(800px_600px_at_50%_10%,rgba(255,255,255,0.08),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_700px_at_20%_30%,rgba(0,255,200,0.06),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_700px_at_80%_40%,rgba(80,120,255,0.05),transparent_60%)]" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl">
        <div className="overflow-hidden rounded-[28px] bg-white/[0.04] shadow-[0_40px_120px_rgba(0,0,0,0.65)] ring-1 ring-white/10 backdrop-blur-xl">
          <div className="flex min-h-[680px]">
            <Sidebar />

            <div className="min-w-0 flex-1">
              <Topbar />

              <div className="px-8 py-6">
                <header className="mb-6">
                  <div className="text-2xl font-extrabold tracking-tight text-white">Library</div>
                  <div className="mt-1 text-sm text-white/55">{periodLabel}</div>
                </header>

                <section className="mb-8">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-semibold text-white/80">Favorite Artists</div>
                    <Link
                      href="/circuit"
                      className="text-xs font-semibold uppercase tracking-[0.25em] text-orange-400/90 hover:text-orange-300"
                    >
                      View more
                    </Link>
                  </div>

                  <div className="flex gap-5 overflow-x-auto pb-2">
                    {topArtists.map((a) => (
                      <Link
                        key={a.id}
                        href={a.id ? `/artist/discovery/${a.id}` : "/charts"}
                        className="group flex w-[112px] shrink-0 flex-col items-center gap-2"
                      >
                        <div className="h-[92px] w-[92px] overflow-hidden rounded-full bg-white/5 ring-1 ring-white/10 transition group-hover:ring-white/20">
                          {a.image ? (
                            <img src={a.image} alt={a.name} className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <AvatarFallback label="Artist" />
                          )}
                        </div>
                        <div className="w-full truncate text-center text-xs font-semibold text-white/75">
                          {a.name}
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>

                <section className="mb-8">
                  <div className="mb-3 text-sm font-semibold text-white/80">Recently Added</div>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    {recently.map((r) => (
                      <button
                        key={r.version_id ?? r.project_id}
                        type="button"
                        className="group text-left"
                        onClick={() => {
                          if (!r.audio_url) return;
                          if (!r.version_id) return;

                          open({
                            projectId: r.project_id,
                            versionId: r.version_id,
                            title: r.track_title ?? "Untitled",
                            subtitle: r.artist_name ?? "Tekkin",
                            audioUrl: r.audio_url,
                          });
                        }}
                      >
                        <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10 transition group-hover:bg-white/[0.07] group-hover:ring-white/20">
                          {r.cover_url ? (
                            <img
                              src={r.cover_url}
                              alt={r.track_title ?? "Tekkin track"}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <CoverFallback label="COVER" />
                          )}
                        </div>
                        <div className="mt-2">
                          <div className="truncate text-sm font-semibold text-white/80">
                            {r.track_title ?? "Untitled"}
                          </div>
                          <div className="truncate text-xs text-white/55">{r.artist_name ?? "Unknown Artist"}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                  <div className="lg:col-span-7">
                    <TrackTable
                      title="Top 100 Global"
                      subtitle="Solo tracce public. Download disattivato."
                      entries={(props.globalSnapshots as unknown as ChartSnapshotEntry[]) ?? []}
                      actionLabel="View all"
                      actionHref="/charts/top100"
                      dense
                    />
                  </div>

                  <div className="lg:col-span-5">
                    <TrackTable
                      title="Top 10 Tekkin Quality"
                      subtitle="Filtro quality, solo public."
                      entries={(props.qualitySnapshots as unknown as ChartSnapshotEntry[]) ?? []}
                      actionLabel="View all"
                      actionHref="/charts/quality"
                      dense
                    />
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Sidebar() {
  const items = [
    { icon: Radio, label: "Radio", active: true },
    { icon: Search, label: "Search" },
    { icon: Heart, label: "Likes" },
    { icon: ListMusic, label: "Library" },
  ];

  return (
    <aside className="w-[88px] border-r border-white/8 bg-black/10">
      <div className="flex h-full flex-col items-center py-5">
        <div className="mb-5 grid h-10 w-10 place-items-center rounded-2xl bg-white/5 ring-1 ring-white/10">
          <div className="h-2 w-2 rounded-full bg-white/70" />
        </div>

        <div className="flex flex-col gap-3">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              className={[
                "grid h-11 w-11 place-items-center rounded-2xl transition",
                it.active ? "bg-white/8 ring-1 ring-white/12" : "bg-white/0 hover:bg-white/6",
              ].join(" ")}
              aria-label={it.label}
            >
              <it.icon className={["h-5 w-5", it.active ? "text-white" : "text-white/65"].join(" ")} />
            </button>
          ))}
        </div>

        <div className="mt-auto w-full px-4 pb-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/35">PLAYLISTS</div>
          <div className="mt-3 space-y-2">
            <div className="h-11 w-11 rounded-2xl bg-white/5 ring-1 ring-white/10" />
            <div className="h-11 w-11 rounded-2xl bg-white/5 ring-1 ring-white/10" />
          </div>
        </div>
      </div>
    </aside>
  );
}

function Topbar() {
  return (
    <div className="flex items-center gap-4 border-b border-white/8 px-6 py-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-2xl bg-black/20 px-4 ring-1 ring-white/10">
          <Search className="h-4 w-4 text-white/55" />
          <input
            className="w-full bg-transparent text-sm text-white/80 placeholder:text-white/35 outline-none"
            placeholder="Search"
          />
        </div>
      </div>

      <button
        type="button"
        className="grid h-10 w-10 place-items-center rounded-2xl bg-white/5 ring-1 ring-white/10 hover:bg-white/8"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4 text-white/70" />
      </button>

      <button
        type="button"
        className="grid h-10 w-10 place-items-center rounded-2xl bg-white/5 ring-1 ring-white/10 hover:bg-white/8"
        aria-label="Settings"
      >
        <Settings2 className="h-4 w-4 text-white/70" />
      </button>

      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-white/5 ring-1 ring-white/10">
          <div className="h-full w-full bg-gradient-to-br from-white/10 via-white/5 to-transparent" />
        </div>
        <div className="text-sm font-semibold text-white/80">Tekkin</div>
      </div>
    </div>
  );
}
