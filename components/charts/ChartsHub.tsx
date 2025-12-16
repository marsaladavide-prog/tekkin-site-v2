import Link from "next/link";
import TopArtistsRow from "./TopArtistsRow";
import TopQualityList from "./TopQualityList";
import Top100List from "./Top100List";
import GenrePlaylistsRow from "./GenrePlaylistsRow";
import type { ChartSnapshotEntry, TopArtistSummary } from "./types";

type ChartsHubProps = {
  periodStart: string | null;
  periodEnd: string | null;
  globalSnapshots: ChartSnapshotEntry[];
  qualitySnapshots: ChartSnapshotEntry[];
  topArtists: TopArtistSummary[];
};

export default function ChartsHub({
  periodStart,
  periodEnd,
  globalSnapshots,
  qualitySnapshots,
  topArtists,
}: ChartsHubProps) {
  const periodLabel =
    periodStart && periodEnd
      ? `periodo ${periodStart} - ${periodEnd}`
      : "classifiche aggiornate settimanalmente";

  return (
  <div className="mx-auto max-w-7xl px-4 py-10">
    <header className="mb-8 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Tekkin Charts</p>
      <h1 className="text-3xl font-semibold text-white md:text-4xl">Charts hub</h1>
      <p className="text-sm text-slate-400">{periodLabel}</p>
    </header>

    {/* TOP: full width */}
    <div className="space-y-10">
      <TopArtistsRow artists={topArtists} />
      <GenrePlaylistsRow />
    </div>

    {/* BOTTOM: two columns */}
    <div className="mt-10 grid gap-10 lg:grid-cols-12">
      <div className="space-y-10 lg:col-span-8">
        <section>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Top 100 Global</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Top 100 Global</h2>
            </div>
            <Link
              href="/charts/global"
              className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-300 hover:text-white"
            >
              Vedi tutto
            </Link>
          </div>

          <Top100List entries={globalSnapshots} />
        </section>
      </div>

      <div className="lg:col-span-4">
        <TopQualityList entries={qualitySnapshots} />
      </div>
    </div>
  </div>
);
}