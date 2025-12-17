import AvatarRail from "./AvatarRail";
import PlaylistCardGrid from "./PlaylistCardGrid";
import TrackTable from "./TrackTable";
import type { ChartSnapshotEntry, TopArtistSummary } from "./types";

type ChartsHubProps = {
  periodStart: string | null;
  periodEnd: string | null;
  globalSnapshots: ChartSnapshotEntry[];
  qualitySnapshots: ChartSnapshotEntry[];
  topArtists: TopArtistSummary[];
};

const genrePlaylists = [
  { id: "minimal", title: "Minimal Deep Tech", description: "Tight groove, clean lows, club focus", href: "/charts/genre/minimal", badge: "Genre" },
  { id: "techhouse", title: "Tech House Modern", description: "Energy + bounce, big drums, crisp top", href: "/charts/genre/tech-house", badge: "Genre" },
  { id: "deephouse", title: "Deep House", description: "Warm, deep, musical, late night", href: "/charts/genre/deep-house", badge: "Genre" },
  { id: "house", title: "House", description: "Classic pulse, modern polish", href: "/charts/genre/house", badge: "Genre" },
  { id: "peak", title: "Peak Time Tools", description: "Weapons built for peak hour", href: "/charts/playlist/peak-time", badge: "Playlist" },
];

export default function ChartsHub({
  periodStart,
  periodEnd,
  globalSnapshots,
  qualitySnapshots,
  topArtists,
}: ChartsHubProps) {
  return (
    <main className="min-h-screen bg-[#06070a] px-6 py-8">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(800px_600px_at_50%_10%,rgba(255,255,255,0.08),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_700px_at_20%_30%,rgba(0,255,200,0.06),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_700px_at_80%_40%,rgba(80,120,255,0.05),transparent_60%)]" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl space-y-6">
        <section className="rounded-3xl bg-white/5 ring-1 ring-white/10 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-2xl font-extrabold tracking-tight text-white">Charts</div>
              <div className="mt-1 text-sm text-white/55">
                Periodo {periodStart ?? "?"} - {periodEnd ?? "?"}
              </div>
            </div>
            <div className="text-sm font-semibold text-white/55">Scopri artisti e tracce public</div>
          </div>

          <div className="mt-5">
            <AvatarRail
              title="Top Artists"
              subtitle="Esplora gli artisti su Circuit"
              items={(topArtists ?? []).map((a) => ({
                id: String(a.id),
                name: String(a.id),
                avatarUrl: null,
              }))}
            />
          </div>
        </section>

        <PlaylistCardGrid
          title="Genre Playlists"
          subtitle="Selezioni tematiche. Ranking diverso dal Top 100."
          actionLabel="View all"
          actionHref="/charts/genres"
          cards={genrePlaylists}
        />

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <TrackTable
              title="Top 100 Global"
              subtitle="Solo tracce public. Download disattivato."
              entries={globalSnapshots}
              actionLabel="View all"
              actionHref="/charts/top100"
              dense={false}
            />
          </div>
          <div className="lg:col-span-4">
            <TrackTable
              title="Top 10 Tekkin Quality"
              subtitle="Filtro quality, solo public."
              entries={qualitySnapshots}
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
