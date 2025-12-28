"use client";

import Link from "next/link";
import AvatarRail from "@/components/charts/AvatarRail";
import PlaylistCardGrid from "@/components/charts/PlaylistCardGrid";
import TrackTable from "@/components/charts/TrackTable";

type TopArtist = {
  id: string | null;
  name: string;
  image_url?: string | null;
  score?: number | null;
};

type PlaylistCard = {
  id: string;
  title: string;
  description: string;
  href: string;
  image?: string | null;
  badge?: string;
};

type SnapshotEntry = {
  profile_key: string;
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

export default function ChartsBillboard(props: {
  periodStart: string | null;
  periodEnd: string | null;

  topArtists: TopArtist[];
  playlists: PlaylistCard[];

  globalTop100: SnapshotEntry[];
  qualityTop10: SnapshotEntry[];
}) {
  return (
    <main className="min-h-screen bg-[#06070a] px-6 py-8">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(800px_600px_at_50%_10%,rgba(255,255,255,0.08),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_700px_at_20%_30%,rgba(0,255,200,0.06),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_700px_at_80%_40%,rgba(80,120,255,0.05),transparent_60%)]" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl space-y-6">
        {/* 1) TOP ARTISTS full width */}
        <section className="rounded-3xl bg-white/5 ring-1 ring-white/10 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-2xl font-extrabold tracking-tight text-white">Top Artists</div>
              <div className="mt-1 text-sm text-white/55">
                Periodo {props.periodStart ?? "?"} - {props.periodEnd ?? "?"}
              </div>
            </div>

            <Link
              href="/circuit"
              className="text-sm font-semibold text-white/70 hover:text-white"
            >
              Esplora gli artisti su Circuit
            </Link>
          </div>

          <div className="mt-5">
            <AvatarRail
              title="Top Artists"
              subtitle="Questa settimana"
              items={(props.topArtists ?? []).map((a) => ({
                id: String(a.id),
                name: String(a.name),
                avatarUrl: null,
              }))}
            />
          </div>
        </section>

        {/* 2) 5 playlist full width */}
        <PlaylistCardGrid
          title="Playlists"
          subtitle="Create da backoffice. Regole di ingresso tracce configurabili."
          actionLabel="Gestisci"
          actionHref="/admin/charts"
          cards={props.playlists}
        />

        {/* 3) Split: 3/4 Top100 + 1/4 Quality */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-9">
            {/* Scroll interno come nello screenshot */}
            <div className="rounded-3xl bg-white/5 ring-1 ring-white/10">
              <div className="border-b border-white/8 px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.3em] text-white/55">
                      Top 100 Global
                    </div>
                    <div className="mt-1 text-sm text-white/45">
                      Solo tracce public. Download disattivato.
                    </div>
                  </div>
                  <Link
                    href="/charts/top100"
                    className="text-xs font-semibold uppercase tracking-[0.25em] text-orange-400/90 hover:text-orange-300"
                  >
                    View all
                  </Link>
                </div>
              </div>

              <div className="max-h-[420px] overflow-auto p-2">
                <TrackTable
                  title=""
                  subtitle=""
                  entries={props.globalTop100 as any}
                  dense
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            <TrackTable
              title="Top 10 Tekkin Quality"
              subtitle="Filtro quality. Solo public."
              entries={props.qualityTop10 as any}
              actionLabel="View all"
              actionHref="/charts/quality"
              dense
            />
          </div>
        </section>
      </div>
    </main>
  );
}
