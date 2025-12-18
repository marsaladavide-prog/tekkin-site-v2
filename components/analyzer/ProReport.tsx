import type { BandCompare } from "@/lib/reference/compareBandsToGenre";
import type { GenreReference } from "@/lib/reference/types";

type ProReportProps = {
  momentaryLufs: number[] | null;
  reference: GenreReference | null;
  referenceLoading: boolean;
  referenceError: string | null;
  bandCompare: BandCompare[] | null;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const formatBandLabel = (input: string) =>
  input.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

const statusColors: Record<string, string> = {
  ok: "text-emerald-400",
  warn: "text-yellow-300",
  off: "text-rose-400",
  no_reference: "text-white/60",
  no_value: "text-white/60",
};

const buildActionPlan = (bands: BandCompare[] | null) => {
  if (!bands) return [];
  const actionable = bands.filter((entry) => entry.status === "warn" || entry.status === "off");
  return actionable.slice(0, 3).map((entry) => {
    if (entry.artist == null || entry.p50 == null) {
      return `${formatBandLabel(entry.key)}: reference unavailable`;
    }
    const diff = entry.artist - entry.p50;
    const direction = diff > 0 ? "riduci" : "aumenta";
    return `${formatBandLabel(entry.key)}: ${direction} ${Math.abs(diff).toFixed(1)} dB per rientrare nel range ideale.`;
  });
};

const computeTimelineStats = (values: number[]) => {
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return { min, max, avg };
};

export default function ProReport({
  momentaryLufs,
  reference,
  referenceLoading,
  referenceError,
  bandCompare,
}: ProReportProps) {
  const timelineStats = momentaryLufs ? computeTimelineStats(momentaryLufs) : null;
  const planItems = buildActionPlan(bandCompare);

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-sm shadow-black/25">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.4em] text-[var(--muted)]">Pro report</p>
          <h2 className="text-2xl font-semibold text-white">Deep insights</h2>
        </div>
        {referenceLoading && (
          <span className="text-xs uppercase tracking-[0.4em] text-white/50">Caricamento reference</span>
        )}
      </div>

      {/* Loudness timeline */}
      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-[var(--muted)]">
              Loudness timeline
            </p>
            <p className="text-sm text-white/70">Momentary LUFS</p>
          </div>
          {timelineStats && (
            <p className="text-xs text-white/60">
              Min {timelineStats.min.toFixed(1)} · Max {timelineStats.max.toFixed(1)} · Avg{" "}
              {timelineStats.avg.toFixed(1)}
            </p>
          )}
        </div>
        {momentaryLufs && timelineStats ? (
          <div className="relative h-28 overflow-hidden rounded-2xl bg-black/40">
            {momentaryLufs.map((value, index) => {
              const normalized = timelineStats.max - timelineStats.min || 1;
              const height = ((value - timelineStats.min) / normalized) * 100;
              return (
                <span
                  key={`${index}-${value}`}
                  className="absolute bottom-0 w-[2px] bg-teal-400"
                  style={{
                    left: `${(index / momentaryLufs.length) * 100}%`,
                    height: `${clamp01(height / 100) * 100}%`,
                  }}
                />
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-white/70">
            Gli array momentary LUFS sono necessari per disegnare la timeline.
          </p>
        )}
      </div>

      {/* Bands comparison */}
      <div className="mt-6 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-[var(--muted)]">Bands vs reference</p>
            <p className="text-sm text-white/70">
              {reference ? reference.profile_key : "Profilo Tekkin non ancora disponibile"}
            </p>
          </div>
          {referenceError && (
            <p className="text-xs text-rose-300">{referenceError}</p>
          )}
        </div>

        {bandCompare ? (
          <div className="space-y-3">
            {bandCompare.map((entry) => {
              const p10 = entry.p10 ?? 0;
              const p90 = entry.p90 ?? 1;
              const artist = entry.artist ?? 0;
              const barWidth = (p90 - p10) || 1;
              const left = clamp01(p10) * 100;
              const width = clamp01(p90 - p10) * 100;
              const dot = clamp01(artist) * 100;

              return (
                <div key={entry.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.3em] text-white/70">
                    <span>{formatBandLabel(entry.key)}</span>
                    <span className={statusColors[entry.status] ?? "text-white/60"}>
                      {entry.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="relative h-2 rounded-full bg-white/5">
                    <div
                      className="absolute left-0 top-0 h-full rounded-full bg-white/10"
                      style={{ left: `${left}%`, width: `${width}%` }}
                    />
                    <div
                      className="absolute -top-1 h-4 w-[2px] bg-teal-300"
                      style={{ left: `${dot}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-white/50">
                    <span>{Number.isFinite(p10) ? p10.toFixed(2) : "--"}</span>
                    <span>{Number.isFinite(p90) ? p90.toFixed(2) : "--"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-white/70">
            Reference o dati bands mancanti. Aggiungi Generator o ricrea l&apos;analisi Tekkin.
          </p>
        )}
      </div>

      {/* Action plan */}
      <div className="mt-6 space-y-3">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-[var(--muted)]">Action plan</p>
          <p className="text-sm text-white/70">
            Suggerimenti basati sulle discrepanze più significative.
          </p>
        </div>
        {planItems.length ? (
          <ul className="space-y-2 text-sm text-white/80">
            {planItems.map((text, index) => (
              <li key={`${text}-${index}`} className="rounded-2xl border border-white/5 bg-black/30 px-4 py-3">
                {text}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-white/70">
            Nessuna discrepanza netta rilevata: mantieni il focus sul tuo riferimento Tekkin.
          </p>
        )}
      </div>
    </section>
  );
}
