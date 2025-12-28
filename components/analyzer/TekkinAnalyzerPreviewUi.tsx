"use client";
type Props = {
  initialData: AnalyzerPreviewData;
  onPlay?: () => void;
  onShare?: () => void;
};



import React, { useMemo, useState } from "react";
import {
  Sparkles,
  Gauge,
  AudioLines,
  SlidersHorizontal,
  Wand2,
  Timer,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Search,
  ArrowRight,
  Copy,
  Filter,
  ChevronDown,
  ChevronUp,
  Link as LinkIcon,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { AnalyzerPreviewData, Severity } from "@/lib/analyzer/previewAdapter";

type ReadyLevel = AnalyzerPreviewData["readyLevel"];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function fmtScore(n: number) {
  return clamp(Math.round(n), 0, 100);
}

function severityLabel(sev: Severity) {
  if (sev === "high") return "Alta";
  if (sev === "med") return "Media";
  return "Bassa";
}

function severityBadge(sev: Severity) {
  if (sev === "high") return <Badge variant="destructive">Alta</Badge>;
  if (sev === "med") return <Badge variant="secondary">Media</Badge>;
  return <Badge variant="outline">Bassa</Badge>;
}

function scoreMood(score: number) {
  if (score >= 85) return { icon: <CheckCircle2 className="h-4 w-4" />, label: "Pronta" };
  if (score >= 70) return { icon: <Flame className="h-4 w-4" />, label: "Molto buona" };
  if (score >= 55) return { icon: <AlertTriangle className="h-4 w-4" />, label: "Da rifinire" };
  return { icon: <AlertTriangle className="h-4 w-4" />, label: "Critica" };
}

function tone(score: number) {
  if (score >= 85) return "Pubblicabile";
  if (score >= 70) return "Quasi";
  if (score >= 55) return "Work in progress";
  return "Non pronta";
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">{children}</div>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const pts = useMemo(() => {
    const v = Array.isArray(values) ? values : [];
    if (v.length < 2) return "";
    const min = Math.min(...v);
    const max = Math.max(...v);
    const span = Math.max(1, max - min);
    const w = 320;
    const h = 84;
    const pad = 6;
    return v
      .map((n, i) => {
        const x = (i / (v.length - 1)) * w;
        const y = h - pad - ((n - min) / span) * (h - pad * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [values]);

  return (
    <svg viewBox="0 0 320 84" className="h-24 w-full" aria-hidden="true">
      <defs>
        <linearGradient id="tekkinSparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgb(217,70,239)" stopOpacity="0.35" />
          <stop offset="1" stopColor="rgb(217,70,239)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {pts ? (
        <>
          <polyline
            points={pts}
            fill="none"
            stroke="rgb(217,70,239)"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <polygon points={`${pts} 320,84 0,84`} fill="url(#tekkinSparkFill)" />
        </>
      ) : null}
    </svg>
  );
}

function ImpactStatsBoard({ data }: { data: AnalyzerPreviewData }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="grid gap-5 md:grid-cols-[360px_1fr] md:items-center">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-white/70">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs">{data.rank.label}</div>
              <div className="text-[11px] text-white/50">Progresso reale, non fuffa</div>
            </div>
          </div>

          <div className="mt-4 flex items-end gap-3">
            <div className="text-4xl font-semibold tracking-tight">
              {data.rank.value.toLocaleString("it-IT")}
            </div>
            <Badge variant="outline" className="border-white/10 text-white/70">
              {tone(data.metrics.qualityScore)}
            </Badge>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
              <div className="text-xs text-white/50">Questa season</div>
              <div className="mt-1 text-lg font-semibold">
                {formatInt(data.rank.thisSeason)}
              </div>
            </div>
	            <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
	              <div className="text-xs text-white/50">Quest&apos;anno</div>
              <div className="mt-1 text-lg font-semibold">
                {formatInt(data.rank.thisYear)}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">Trend</div>
            <div className="text-xs text-white/50">Ultimi mesi</div>
          </div>
          <div className="mt-2">
            <Sparkline values={data.rank.series} />
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-2 md:grid-cols-5">
        {data.rank.totals.map((t, idx) => (
          <div key={idx} className="rounded-2xl border border-white/10 bg-black/30 p-3">
            <div className="text-xs text-white/50">{t.label}</div>
            <div className="mt-1 text-lg font-semibold">{t.value}</div>
            {t.hint ? <div className="mt-1 text-[11px] text-white/45">{t.hint}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function TopBar({
  data,
  onPlay,
  onShare,
}: {
  data: AnalyzerPreviewData;
  onPlay?: () => void;
  onShare?: () => void;
}) {
  const mood = scoreMood(data.metrics.qualityScore);
  const q = fmtScore(data.metrics.qualityScore);

  return (
    <div className="sticky top-0 z-20 -mx-4 mb-6 border-b border-white/10 bg-neutral-950/80 px-4 py-3 backdrop-blur">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-2xl bg-white/5">
            {data.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.coverUrl} alt="cover" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <AudioLines className="h-5 w-5 text-white/60" />
              </div>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="truncate text-base font-semibold tracking-tight">{data.trackTitle}</div>
              <Badge variant="outline" className="border-white/10 text-white/80">
                {data.profileKey}
              </Badge>
              <Badge variant="outline" className="border-white/10 text-white/80">
                {data.referenceModel}
              </Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/60">
              <span className="truncate">{data.artistName}</span>
              <span className="text-white/30">•</span>
              <span>
                {data.metrics.bpm} BPM · Key {data.metrics.key} · {data.metrics.loudnessLufs} LUFS
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 md:justify-end">
          <div className="hidden md:flex items-center gap-2">
            <Badge className="gap-1 bg-white/10 text-white hover:bg-white/10">
              {mood.icon}
              {mood.label}
            </Badge>
            <div className="w-44">
              <Progress value={q} className="h-2" />
              <div className="mt-1 flex justify-between text-[11px] text-white/40">
                <span>Quality</span>
                <span>{q}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" className="rounded-2xl" onClick={() => onPlay?.()}>
              Play
            </Button>
            <Button type="button" variant="secondary" className="rounded-2xl" onClick={() => onShare?.()}>
              <LinkIcon className="mr-2 h-4 w-4" />
              Share
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreCard({ title, value, subtitle }: { title: string; value: number; subtitle: string }) {
  const score = fmtScore(value);
  return (
    <Card className="rounded-3xl border-white/10 bg-white/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-white/70">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-4xl font-semibold tracking-tight">{score}</div>
            <div className="mt-1 text-xs text-white/50">{subtitle}</div>
          </div>
          <div className="w-40">
            <Progress value={score} className="h-2" />
            <div className="mt-2 flex justify-between text-[11px] text-white/40">
              <span>0</span>
              <span>100</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickFacts({ data }: { data: AnalyzerPreviewData }) {
  return (
    <Card className="rounded-3xl border-white/10 bg-white/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-white/70">Quick facts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
            <div className="text-xs text-white/50">BPM</div>
            <div className="mt-1 text-lg font-semibold">{data.metrics.bpm}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
            <div className="text-xs text-white/50">LUFS</div>
            <div className="mt-1 text-lg font-semibold">{data.metrics.loudnessLufs}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
            <div className="text-xs text-white/50">Key</div>
            <div className="mt-1 text-lg font-semibold">{data.metrics.key}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
            <div className="text-xs text-white/50">Status</div>
            <div className="mt-1 text-lg font-semibold">{tone(data.metrics.qualityScore)}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button className="rounded-2xl">
            <Gauge className="mr-2 h-4 w-4" />
            Apri report
          </Button>
          <Button variant="secondary" className="rounded-2xl">
            <Timer className="mr-2 h-4 w-4" />
            Re-analyze
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  const v = fmtScore(value);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="text-xs text-white/60">{label}</div>
      <div className="mt-2 flex items-center gap-3">
        <Progress value={v} className="h-2" />
        <div className="w-8 text-right text-xs text-white/70">{v}</div>
      </div>
    </div>
  );
}

function CollapsibleIssue({
  item,
  isOpen,
  onToggle,
  onCopy,
}: {
  item: AnalyzerPreviewData["issues"][number];
  isOpen: boolean;
  onToggle: () => void;
  onCopy: () => void;
}) {
  return (
    <Card className="rounded-3xl border-white/10 bg-white/5">
      <CardHeader className="pb-2">
        <button type="button" onClick={onToggle} className="flex w-full items-start justify-between gap-3 text-left">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <CardTitle className="truncate text-sm font-semibold">{item.title}</CardTitle>
              {severityBadge(item.severity)}
              {typeof item.etaMin === "number" ? (
                <Badge variant="outline" className="border-white/10 text-white/70">
                  ~{item.etaMin} min
                </Badge>
              ) : null}
            </div>
            <div className="mt-1 text-xs text-white/50">Fix guidato, senza fuffa. Azione singola.</div>
          </div>
          <div className="mt-1 shrink-0 text-white/50">
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </button>
      </CardHeader>

      {isOpen ? (
        <CardContent className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
            <div className="text-xs font-medium text-white/70">Perché conta</div>
            <div className="mt-1 text-sm text-white/70">{item.why}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
            <div className="text-xs font-medium text-white/70">Fix rapido</div>
            <div className="mt-1 text-sm text-white/70">{item.fix}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="rounded-2xl">
              <Wand2 className="mr-2 h-4 w-4" />
              {item.actionLabel}
            </Button>
            <Button variant="secondary" className="rounded-2xl" onClick={onCopy}>
              <Copy className="mr-2 h-4 w-4" />
              Copia nota
            </Button>
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}

function PlanBlock({ title, bullets }: { title: string; bullets: string[] }) {
  return (
    <Card className="rounded-3xl border-white/10 bg-white/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="list-disc space-y-2 pl-5 text-sm text-white/70">
          {bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function RefRow({ title, artist, match, notes }: { title: string; artist: string; match: number; notes: string[] }) {
  const m = fmtScore(match);
  return (
    <div className="flex flex-col gap-2 rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{title}</div>
          <div className="truncate text-xs text-white/60">{artist}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-semibold">{m}%</div>
          <div className="text-[11px] text-white/50">match</div>
        </div>
      </div>
      <Progress value={m} className="h-2" />
      <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-white/60">
        {notes.slice(0, 3).map((nn, i) => (
          <li key={i}>{nn}</li>
        ))}
      </ul>
    </div>
  );
}

function formatInt(n: number) {
  const x = Math.round(Number.isFinite(n) ? n : 0);
  return String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export default function TekkinAnalyzerPreviewUi({ initialData, onPlay, onShare }: Props) {
  const [data, setData] = useState<AnalyzerPreviewData>(initialData);
  const [query, setQuery] = useState("");
  const [sev, setSev] = useState<Severity | "all">("all");
  const [openId, setOpenId] = useState<string | null>(initialData.issues?.[0]?.id ?? null);

  const quickReady = data.readyLevel === "quick" || data.readyLevel === "pro";
  const proReady = data.readyLevel === "pro";

  const nextAction = useMemo(() => {
    const sorted = [...data.issues].sort((a, b) => {
      const w = (s: Severity) => (s === "high" ? 3 : s === "med" ? 2 : 1);
      const dw = w(b.severity) - w(a.severity);
      if (dw !== 0) return dw;
      const ta = typeof a.etaMin === "number" ? a.etaMin : 999;
      const tb = typeof b.etaMin === "number" ? b.etaMin : 999;
      return ta - tb;
    });
    return sorted[0] ?? null;
  }, [data.issues]);

  const filteredIssues = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.issues.filter((i) => {
      if (sev !== "all" && i.severity !== sev) return false;
      if (!q) return true;
      return [i.title, i.why, i.fix].some((t) => t.toLowerCase().includes(q));
    });
  }, [data.issues, query, sev]);

  const toggleReady = () => {
    const order: ReadyLevel[] = ["pro", "quick", "none"];
    const idx = order.indexOf(data.readyLevel);
    const next = order[(idx + 1) % order.length] ?? "pro";
    setData((prev) => ({ ...prev, readyLevel: next }));
  };

  return (
    <Shell>
      <TopBar data={data} onPlay={onPlay} onShare={onShare} />

      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-white/70">
          <Sparkles className="h-4 w-4" />
          <span className="text-sm">Tekkin Analyzer</span>
          <span className="text-white/40">/</span>
          <span className="text-sm text-white/50">Preview UI</span>
        </div>

        <Button variant="secondary" className="rounded-2xl" onClick={toggleReady}>
          Toggle readyLevel
        </Button>
      </div>

      <ImpactStatsBoard data={data} />

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <ScoreCard title="Quality" value={data.metrics.qualityScore} subtitle="Qualità percepita e solidità" />
        <ScoreCard title="Overall" value={data.metrics.overallScore} subtitle="Score complessivo Tekkin" />
        <QuickFacts data={data} />
      </div>

      {nextAction ? (
        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4 md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-white/10 text-white hover:bg-white/10">Next action</Badge>
                <Badge variant="outline" className="border-white/10 text-white/70">
                  {severityLabel(nextAction.severity)}
                </Badge>
                {typeof nextAction.etaMin === "number" ? (
                  <Badge variant="outline" className="border-white/10 text-white/70">
                    ~{nextAction.etaMin} min
                  </Badge>
                ) : null}
              </div>
              <div className="mt-2 truncate text-lg font-semibold">{nextAction.title}</div>
              <div className="mt-1 text-sm text-white/60">{nextAction.fix}</div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button className="rounded-2xl" onClick={() => setOpenId(nextAction.id)}>
                Apri fix <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="secondary" className="rounded-2xl" onClick={() => setSev("high")}>
                Focus high
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Tabs defaultValue="quick" className="mt-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Report</h2>
            <p className="mt-1 text-sm text-white/60">
              Quick: decide. Pro: migliora. Una sola azione concreta per volta.
            </p>
          </div>
          <TabsList className="rounded-2xl bg-white/5">
            <TabsTrigger value="quick" className="rounded-2xl">
              Quick
            </TabsTrigger>
            <TabsTrigger value="pro" className="rounded-2xl">
              Pro
            </TabsTrigger>
            <TabsTrigger value="refs" className="rounded-2xl">
              References
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="quick" className="mt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="rounded-3xl border-white/10 bg-white/5 md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <SlidersHorizontal className="h-4 w-4" />
                  Quick health
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!quickReady ? (
                  <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
                    <div className="text-sm font-semibold">Non pronto</div>
                    <div className="mt-2 text-sm text-white/60">
                      Qui mostriamo solo info base quando non ci sono i dati Quick.
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button className="rounded-2xl">Avvia Quick</Button>
                      <Button variant="secondary" className="rounded-2xl">
                        Come funziona
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    <MiniMetric label="Stereo width" value={data.metrics.stereoWidth} />
                    <MiniMetric label="Dynamics" value={data.metrics.dynamics} />
                    <MiniMetric label="Low-end" value={data.metrics.lowEnd} />
                    <MiniMetric label="High-end" value={data.metrics.highEnd} />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-white/10 bg-white/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="h-4 w-4" />
                  AI next move
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="text-xs font-medium text-white/70">Obiettivo</div>
                  <div className="mt-1 text-sm text-white/70">Portala in publish zone senza perdere vibe.</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="text-xs font-medium text-white/70">Azione</div>
                  <div className="mt-1 text-sm text-white/70">Fix 1 problema e rimbalza.</div>
                </div>
                <Button className="w-full rounded-2xl">
                  Apri piano <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pro" className="mt-6">
          {!proReady ? (
            <Card className="rounded-3xl border-white/10 bg-white/5">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-lg font-semibold">Pro non disponibile</div>
                    <p className="mt-2 text-sm text-white/60">
                      Pro compare solo quando ci sono arrays, bands_norm, profile_key e reference.
                    </p>
                  </div>
                  <Button className="rounded-2xl">Sblocca Pro</Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
              <div className="space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center">
                    <div className="relative w-full md:w-80">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                      <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Cerca issue (kick, bass, hats...)"
                        className="h-10 rounded-2xl border-white/10 bg-white/5 pl-10 text-white placeholder:text-white/40"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-white/10 text-white/70">
                        {filteredIssues.length} issue
                      </Badge>

                      <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-white/5 p-1">
                        <button
                          type="button"
                          onClick={() => setSev("all")}
                          className={`rounded-xl px-2 py-1 text-xs ${
                            sev === "all" ? "bg-white/10 text-white" : "text-white/60"
                          }`}
                        >
                          <span className="inline-flex items-center gap-1">
                            <Filter className="h-3 w-3" /> All
                          </span>
                        </button>
                        {(["high", "med", "low"] as const).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setSev(s)}
                            className={`rounded-xl px-2 py-1 text-xs ${
                              sev === s ? "bg-white/10 text-white" : "text-white/60"
                            }`}
                          >
                            {severityLabel(s)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" className="rounded-2xl">
                      Esporta report
                    </Button>
                    <Button className="rounded-2xl">Checklist mastering</Button>
                  </div>
                </div>

                <div className="grid gap-4">
                  {filteredIssues.map((it) => (
                    <CollapsibleIssue
                      key={it.id}
                      item={it}
                      isOpen={openId === it.id}
                      onToggle={() => setOpenId((prev) => (prev === it.id ? null : it.id))}
                      onCopy={() => {
                        const text = `${it.title}\n\nPerché: ${it.why}\n\nFix: ${it.fix}`;
                        void navigator.clipboard?.writeText(text);
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                {data.suggestions.map((s, idx) => (
                  <PlanBlock key={idx} title={s.title} bullets={s.bullets} />
                ))}

                <Card className="rounded-3xl border-white/10 bg-white/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Publish readiness</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                      <div className="text-xs font-medium text-white/70">Regola</div>
                      <div className="mt-1 text-sm text-white/70">Puoi pubblicare solo versioni master.</div>
                    </div>
                    <Button className="w-full rounded-2xl">Set visibility: public</Button>
                    <Button variant="secondary" className="w-full rounded-2xl">
                      Secret link
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="refs" className="mt-6">
          <div className="grid gap-4 md:grid-cols-3">
            {data.references.map((r, idx) => (
              <RefRow key={idx} title={r.title} artist={r.artist} match={r.match} notes={r.notes} />
            ))}
          </div>
          <Card className="mt-4 rounded-3xl border-white/10 bg-white/5">
            <CardContent className="p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-semibold">Obiettivo References</div>
                  <div className="mt-1 text-sm text-white/60">
                    Solo 3 reference, differenze chiare, azioni pratiche.
                  </div>
                </div>
                <Button className="rounded-2xl">Scegli reference set</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-white/70">
            <AudioLines className="h-4 w-4" />
            <span className="text-sm">UI principle</span>
          </div>
          <Badge variant="outline" className="border-white/10 text-white/60">
            Less boxes, more hierarchy
          </Badge>
        </div>
        <p className="mt-3 text-sm text-white/60">
          Nota: in produzione, sostituisci Shell con AppShell e aggancia i dati dal view-model di handleAnalyzerResult.
        </p>
      </div>
    </Shell>
  );
}
