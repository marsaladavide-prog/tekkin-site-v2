type HighlightItem = {
  label: string;
  detail: string;
};

type QuickReportProps = {
  versionName?: string | null;
  tekkinScore: number;
  lufs: number;
  bpm: number;
  analyzerKey: string | null;
  matchPercent: number | null;
  highlights: HighlightItem[];
  referenceStatusMessage?: string | null;
  profileLabel?: string;
};

const formatTekkinScore = (value: number) => Number.isFinite(value) ? value.toFixed(1) : "0.0";
const formatLuFs = (value: number) => Number.isFinite(value) ? `${value.toFixed(1)} LUFS` : "--";
const formatBpm = (value: number) => Number.isFinite(value) ? Math.round(value).toString() : "--";

export default function QuickReport({
  versionName,
  tekkinScore,
  lufs,
  bpm,
  analyzerKey,
  matchPercent,
  highlights,
  referenceStatusMessage,
  profileLabel,
}: QuickReportProps) {
  const displayKey = analyzerKey ?? "In elaborazione";
  const displayMatch =
    matchPercent != null ? `${matchPercent.toFixed(1)}%` : "Calcolo reference in corso";

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-sm shadow-black/25">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.4em] text-[var(--muted)]">Quick report</p>
          <h2 className="text-2xl font-semibold text-white">Tekkin status</h2>
          {versionName && (
            <p className="text-sm text-white/70">Versione: {versionName}</p>
          )}
        </div>
        {profileLabel && (
          <span className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.4em] text-white/80">
            {profileLabel}
          </span>
        )}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Tekkin score</p>
          <p className="text-3xl font-semibold text-white">Tekkin {formatTekkinScore(tekkinScore)}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Integrati</p>
          <p className="text-2xl font-semibold text-white">{formatLuFs(lufs)}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">BPM / Key</p>
          <p className="text-xl font-semibold text-white">{formatBpm(bpm)}</p>
          <p className="text-sm text-white/60">{displayKey}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Match %</p>
          <p className="text-2xl font-semibold text-white">{displayMatch}</p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <div className="text-[11px] uppercase tracking-[0.5em] text-[var(--muted)]">Highlights</div>
        {highlights.length ? (
          <ul className="space-y-2 text-sm text-white/80">
            {highlights.map((item) => (
              <li key={item.label} className="flex items-start gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.4em] text-teal-300">
                  {item.label}
                </span>
                <span>{item.detail}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-white/70">
            {referenceStatusMessage ?? "Highlights disponibili appena il reference Tekkin è pronto."}
          </p>
        )}
      </div>
    </section>
  );
}
