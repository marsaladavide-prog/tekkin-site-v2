"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  Sun,
  Moon,
  FolderKanban,
  Library,
  Radar,
  BarChart3,
  Sparkles,
  Upload,
  ArrowRight,
} from "lucide-react";

type ThemeMode = "day" | "night";

function cn(...args: Array<string | false | null | undefined>) {
  return args.filter(Boolean).join(" ");
}

function Pill({
  mode,
  children,
  tone = "neutral",
}: {
  mode: ThemeMode;
  children: React.ReactNode;
  tone?: "neutral" | "cyan";
}) {
  const isNight = mode === "night";

  const base = "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold";
  const neutral = isNight
    ? "border-white/10 bg-white/5 text-white/75"
    : "border-black/10 bg-black/5 text-black/70";

  const cyan = isNight
    ? "border-cyan-400/20 bg-cyan-500/15 text-cyan-100"
    : "border-cyan-700/20 bg-cyan-500/10 text-cyan-900";

  return <span className={cn(base, tone === "cyan" ? cyan : neutral)}>{children}</span>;
}

function IconBadge({ mode, children }: { mode: ThemeMode; children: React.ReactNode }) {
  const isNight = mode === "night";
  return (
    <div
      className={cn(
        "grid h-10 w-10 place-items-center rounded-2xl ring-1",
        isNight ? "bg-white/10 ring-white/10" : "bg-black/5 ring-black/10"
      )}
    >
      {children}
    </div>
  );
}

function ActionButton({
  mode,
  children,
  tone = "neutral",
  className,
}: {
  mode: ThemeMode;
  children: React.ReactNode;
  tone?: "neutral" | "primary";
  className?: string;
}) {
  const isNight = mode === "night";

  const neutral = isNight
    ? "border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
    : "border-black/10 bg-black/5 text-black/70 hover:bg-black/10";

  const primary = isNight
    ? "border-cyan-400/20 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/20"
    : "border-cyan-700/20 bg-cyan-500/10 text-cyan-900 hover:bg-cyan-500/15";

  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-2xl border px-4 text-xs font-semibold transition",
        tone === "primary" ? primary : neutral,
        className
      )}
    >
      {children}
    </button>
  );
}

function Divider({ mode }: { mode: ThemeMode }) {
  const isNight = mode === "night";
  return <div className={cn("h-px w-full", isNight ? "bg-white/10" : "bg-black/10")} />;
}

function StatTile({ mode, label, value }: { mode: ThemeMode; label: string; value: string }) {
  const isNight = mode === "night";
  return (
    <div className={cn("rounded-2xl border p-4", isNight ? "border-white/10 bg-black/35" : "border-black/10 bg-white")}>
      <div className={cn("text-xs", isNight ? "text-white/55" : "text-black/55")}>{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function NavItem({
  mode,
  href,
  icon,
  label,
  active,
}: {
  mode: ThemeMode;
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  const isNight = mode === "night";
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition",
        active
          ? isNight
            ? "bg-white/10 text-white"
            : "bg-black/5 text-black"
          : isNight
            ? "text-white/75 hover:bg-white/5"
            : "text-black/70 hover:bg-black/5"
      )}
    >
      <span
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-lg ring-1",
          isNight ? "bg-white/10 ring-white/10" : "bg-black/10 ring-black/10"
        )}
      >
        {icon}
      </span>
      {label}
    </Link>
  );
}

function Sidebar({ mode }: { mode: ThemeMode }) {
  const isNight = mode === "night";

  return (
    <aside className={cn("hidden h-full w-72 flex-col border-r p-4 lg:flex", isNight ? "border-white/10 bg-black/35" : "border-black/10 bg-white")}>
      <div className="flex items-center gap-2 px-2 py-2">
        <div className={cn("grid h-9 w-9 place-items-center rounded-2xl ring-1", isNight ? "bg-white/10 ring-white/10" : "bg-black/5 ring-black/10")}>
          <span className="text-sm font-semibold">K</span>
        </div>
        <div className="leading-tight">
          <div className={cn("text-sm font-semibold tracking-wide", isNight ? "text-white" : "text-black")}>TEKKIN</div>
          <div className={cn("text-xs", isNight ? "text-white/55" : "text-black/55")}>Artist Workspace</div>
        </div>
      </div>

      <div className="mt-3">
        <input
          placeholder="New Thread..."
          className={cn(
            "h-10 w-full rounded-2xl border px-3 text-sm outline-none",
            isNight
              ? "border-white/10 bg-white/5 text-white placeholder:text-white/35 focus:border-white/20"
              : "border-black/10 bg-black/5 text-black placeholder:text-black/40 focus:border-black/20"
          )}
        />
      </div>

      <div className="mt-4 space-y-1">
        <NavItem mode={mode} href="/artist/projects" icon={<FolderKanban className="h-4 w-4" />} label="Projects" active />
        <NavItem mode={mode} href="/artist/library" icon={<Library className="h-4 w-4" />} label="Library" />
        <NavItem mode={mode} href="/artist/discovery" icon={<Radar className="h-4 w-4" />} label="Discovery" />
        <NavItem mode={mode} href="/artist/dashboard" icon={<BarChart3 className="h-4 w-4" />} label="Dashboard" />
      </div>

      <div className={cn("mt-auto rounded-2xl border p-3", isNight ? "border-white/10 bg-white/5" : "border-black/10 bg-black/5")}>
        <div className={cn("text-xs", isNight ? "text-white/55" : "text-black/55")}>Suggerimento</div>
        <div className={cn("mt-1 text-sm", isNight ? "text-white" : "text-black")}>
          Library per ascoltare e scegliere, Projects per lavorare e decidere.
        </div>
      </div>
    </aside>
  );
}

function BigCardLink({
  mode,
  href,
  title,
  subtitle,
  icon,
  cta,
}: {
  mode: ThemeMode;
  href: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  cta: string;
}) {
  const isNight = mode === "night";
  return (
    <Link
      href={href}
      className={cn(
        "group block rounded-2xl border p-5 transition",
        isNight ? "border-white/10 bg-black/35 hover:bg-white/[0.03]" : "border-black/10 bg-white hover:bg-black/[0.03]"
      )}
    >
      <div className="flex items-start gap-4">
        <IconBadge mode={mode}>{icon}</IconBadge>
        <div className="min-w-0 flex-1">
          <div className={cn("text-base font-semibold", isNight ? "text-white" : "text-black")}>{title}</div>
          <div className={cn("mt-1 text-sm", isNight ? "text-white/60" : "text-black/60")}>{subtitle}</div>

          <div className="mt-4 inline-flex items-center gap-2">
            <Pill mode={mode}>{cta}</Pill>
            <ArrowRight className={cn("h-4 w-4 transition-transform group-hover:translate-x-0.5", isNight ? "text-white/70" : "text-black/60")} />
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function ArtistHomePage() {
  const [mode, setMode] = useState<ThemeMode>("night");
  const [q, setQ] = useState("");

  const isNight = mode === "night";

  const cards = useMemo(
    () => [
      {
        href: "/artist/projects",
        title: "Projects",
        subtitle: "Versioni, Analyzer, decisioni. Il posto dove lavori davvero.",
        icon: <FolderKanban className="h-5 w-5" />,
        cta: "Apri Projects",
      },
      {
        href: "/artist/library",
        title: "Library",
        subtitle: "Ascolta come catalogo. Seleziona e poi converti in project.",
        icon: <Library className="h-5 w-5" />,
        cta: "Apri Library",
      },
      {
        href: "/artist/discovery",
        title: "Discovery",
        subtitle: "Circuit, invii e segnali. Trova occasioni e placement.",
        icon: <Radar className="h-5 w-5" />,
        cta: "Apri Discovery",
      },
    ],
    []
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return cards;
    return cards.filter((c) => `${c.title} ${c.subtitle}`.toLowerCase().includes(s));
  }, [q, cards]);

  return (
    <div className={cn("h-screen w-full", isNight ? "bg-black text-white" : "bg-white text-black")}>
      <div
        className={cn(
          "absolute inset-0 opacity-70",
          isNight
            ? "[background:radial-gradient(900px_500px_at_70%_10%,rgba(34,211,238,0.18),transparent_60%),radial-gradient(700px_420px_at_20%_0%,rgba(255,255,255,0.07),transparent_60%)]"
            : "[background:radial-gradient(900px_500px_at_70%_10%,rgba(34,211,238,0.12),transparent_60%),radial-gradient(700px_420px_at_20%_0%,rgba(0,0,0,0.06),transparent_60%)]"
        )}
      />

      <div className="relative flex h-full">
        <Sidebar mode={mode} />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className={cn("border-b px-5 py-4", isNight ? "border-white/10 bg-black/25" : "border-black/10 bg-white/80")}>
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-lg font-semibold">Artist</div>
                <div className={cn("text-sm", isNight ? "text-white/55" : "text-black/55")}>
                  Home semplice: scegli dove entrare e vai dritto al punto.
                </div>
              </div>

              <div className="flex items-center gap-2">
                <ActionButton mode={mode} tone="neutral" onClick={() => setMode("day")}>
                  <Sun className="h-4 w-4" />
                  DAY
                </ActionButton>
                <ActionButton mode={mode} tone="neutral" onClick={() => setMode("night")}>
                  <Moon className="h-4 w-4" />
                  NIGHT
                </ActionButton>
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-6xl px-5 py-5">
            <section className={cn("overflow-hidden rounded-2xl border", isNight ? "border-white/10 bg-black/35" : "border-black/10 bg-white")}>
              <div className="relative h-[220px]">
                <div className={cn("absolute inset-0 opacity-85", isNight ? "bg-gradient-to-r from-lime-400 via-yellow-300 to-orange-400" : "bg-gradient-to-r from-lime-300 via-yellow-200 to-orange-300")} />
                <div
                  className={cn(
                    "absolute inset-0",
                    isNight
                      ? "bg-[radial-gradient(circle_at_25%_30%,rgba(0,0,0,0.0),rgba(0,0,0,0.78)_60%,rgba(0,0,0,0.95)_100%)]"
                      : "bg-[radial-gradient(circle_at_25%_30%,rgba(255,255,255,0.0),rgba(255,255,255,0.75)_55%,rgba(255,255,255,0.95)_100%)]"
                  )}
                />
                <div className={cn("absolute right-0 top-0 h-full w-[42%]", isNight ? "bg-black/80" : "bg-white/80", "[clip-path:ellipse(80%_90%_at_70%_50%)]")} />

                <div className="relative z-10 flex h-full items-end justify-between gap-6 px-6 pb-6">
                  <div className="flex items-end gap-4">
                    <div className={cn("h-20 w-20 rounded-full ring-1", isNight ? "bg-black/90 ring-white/10" : "bg-white ring-black/10")} />
                    <div>
                      <div className="text-2xl font-semibold">Tekkin Artist</div>
                      <div className={cn("mt-1 text-sm", isNight ? "text-white/70" : "text-black/60")}>
                        Ascolta, organizza, analizza e pubblica con meno frizione.
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Pill mode={mode}>Minimal / Deep Tech</Pill>
                        <Pill mode={mode}>Rank 62</Pill>
                        <Pill mode={mode} tone="cyan">
                          Analyzer Pro
                        </Pill>
                      </div>
                    </div>
                  </div>

                  <div className="hidden md:flex items-center gap-2">
                    <ActionButton mode={mode} tone="primary">
                      <Upload className="h-4 w-4" />
                      Carica
                    </ActionButton>
                    <ActionButton mode={mode} tone="neutral">
                      <Sparkles className="h-4 w-4" />
                      Analyzer
                    </ActionButton>
                  </div>
                </div>
              </div>

              <div className={cn("border-t px-6 py-4", isNight ? "border-white/10" : "border-black/10")}>
                <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div>
                    <div className="text-sm font-semibold">Entry point</div>
                    <div className={cn("text-xs", isNight ? "text-white/55" : "text-black/55")}>
                      Vai dove ti serve adesso, senza perdere tempo.
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative w-full sm:w-80">
                      <Search className={cn("pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2", isNight ? "text-white/45" : "text-black/45")} />
                      <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Cerca sezione..."
                        className={cn(
                          "h-10 w-full rounded-2xl border pl-9 pr-3 text-sm outline-none",
                          isNight
                            ? "border-white/10 bg-white/5 text-white placeholder:text-white/35 focus:border-white/20"
                            : "border-black/10 bg-black/5 text-black placeholder:text-black/40 focus:border-black/20"
                        )}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
              <section className={cn("rounded-2xl border p-4", isNight ? "border-white/10 bg-black/35" : "border-black/10 bg-white")}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">Workspace</div>
                    <div className={cn("text-xs", isNight ? "text-white/55" : "text-black/55")}>Tre card, scelta immediata.</div>
                  </div>
                  <Pill mode={mode}>{filtered.length} sezioni</Pill>
                </div>

                <div className="mt-4">
                  <Divider mode={mode} />
                </div>

                <div className="mt-4 space-y-3">
                  {filtered.map((c) => (
                    <BigCardLink
                      key={c.href}
                      mode={mode}
                      href={c.href}
                      title={c.title}
                      subtitle={c.subtitle}
                      icon={c.icon}
                      cta={c.cta}
                    />
                  ))}
                </div>

                <div className={cn("mt-4 text-xs", isNight ? "text-white/45" : "text-black/45")}>
                  Library è catalogo, Projects è lavoro.
                </div>
              </section>

              <aside className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <StatTile mode={mode} label="Progetti attivi" value="2" />
                  <StatTile mode={mode} label="Tracce in Library" value="14" />
                  <StatTile mode={mode} label="Signals inviati" value="6" />
                  <StatTile mode={mode} label="Rank" value="62" />
                </div>

                <section className={cn("rounded-2xl border p-4", isNight ? "border-white/10 bg-black/35" : "border-black/10 bg-white")}>
                  <div className="text-sm font-semibold">Quick actions</div>
                  <div className={cn("mt-1 text-sm", isNight ? "text-white/60" : "text-black/60")}>
                    Shortcut secchi, niente menu strani.
                  </div>

                  <div className="mt-4 grid gap-2">
                    <Link href="/artist/projects">
                      <ActionButton mode={mode} className="w-full justify-start">
                        <FolderKanban className="h-4 w-4" />
                        Apri Projects
                      </ActionButton>
                    </Link>

                    <Link href="/artist/library">
                      <ActionButton mode={mode} className="w-full justify-start">
                        <Library className="h-4 w-4" />
                        Apri Library
                      </ActionButton>
                    </Link>

                    <Link href="/artist/discovery">
                      <ActionButton mode={mode} className="w-full justify-start">
                        <Radar className="h-4 w-4" />
                        Apri Discovery
                      </ActionButton>
                    </Link>

                    <ActionButton mode={mode} tone="primary" className="w-full justify-start">
                      <Sparkles className="h-4 w-4" />
                      Analyzer Pro
                    </ActionButton>
                  </div>

                  <div className={cn("mt-4 text-xs", isNight ? "text-white/45" : "text-black/45")}>
                    Qui dopo mettiamo 1 suggerimento AI basato su ultima analisi.
                  </div>
                </section>
              </aside>
            </div>

            <div className={cn("mt-6 text-center text-xs", isNight ? "text-white/35" : "text-black/40")}>
              Tekkin Artist: semplice, chiaro, gradevole.
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
