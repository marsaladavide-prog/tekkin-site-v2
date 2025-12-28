"use client";

import React from "react";
import type { RefState } from "./refState";

export type StatusTone = "ok" | "low" | "mid" | "high" | "muted";

const PILL_BASE =
  "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] transition";

export function Pill({
  tone,
  children,
  title,
}: {
  tone: StatusTone;
  children: React.ReactNode;
  title?: string;
}) {
  const cls =
    tone === "ok"
      ? "border-emerald-400/25 bg-white/5 text-white/80 ring-white/10 hover:bg-white/10"
      : tone === "mid"
      ? "border-white/15 bg-white/8 text-white/75"
      : tone === "high"
      ? "border-amber-400/25 bg-amber-400/15 text-amber-200"
      : "border-white/10 bg-white/5 text-white/60";

  return (
    <span className={`${PILL_BASE} ${cls}`} title={title}>
      {children}
    </span>
  );
}

export function StatusChip({
  tone,
  children,
}: {
  tone: StatusTone;
  children: React.ReactNode;
}) {
  const cls =
    tone === "ok"
      ? "border-emerald-400/30 bg-emerald-400/15 text-emerald-100"
      : tone === "low"
      ? "border-sky-400/30 bg-sky-400/15 text-sky-100"
      : tone === "mid"
      ? "border-white/15 bg-white/8 text-white/75"
      : tone === "high"
      ? "border-amber-400/35 bg-amber-400/20 text-amber-100"
      : "border-white/10 bg-white/5 text-white/60";
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-wide ${cls}`}>
      {children}
    </span>
  );
}

export function Card({
  title,
  subtitle,
  right,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  subtitle?: string | null;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/4 p-5 ${className ?? ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-white">{title}</div>
          {subtitle ? <div className="mt-0.5 text-xs text-white/55">{subtitle}</div> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className={`mt-4 ${bodyClassName ?? ""}`}>{children}</div>
    </div>
  );
}

export function SourcePills({ state }: { state: RefState }) {
  const liveTone: StatusTone = state.live ? "ok" : state.mock ? "mid" : "muted";
  const liveLabel = state.live ? "LIVE" : state.mock ? "MOCK" : "INFO";
  const refTone: StatusTone = state.ref ? "ok" : "muted";
  const refLabel = state.ref ? "REF" : "NO REF";
  return (
    <div className="flex items-center gap-2">
      <Pill tone={liveTone}>{liveLabel}</Pill>
      <Pill tone={refTone}>{refLabel}</Pill>
    </div>
  );
}
