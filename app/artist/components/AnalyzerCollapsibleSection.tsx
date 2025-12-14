"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { type ReactNode, useState } from "react";

type AnalyzerCollapsibleSectionProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function AnalyzerCollapsibleSection({
  title,
  subtitle,
  children,
}: AnalyzerCollapsibleSectionProps) {
const [open, setOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-white/10 bg-black/80 p-4">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between text-left text-sm font-semibold text-white"
        aria-expanded={open}
      >
        <div className="flex flex-col gap-0.5 text-left">
          <span>{title}</span>
          {subtitle ? (
            <span className="text-[11px] font-normal text-white/60">{subtitle}</span>
          ) : null}
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-white/70" />
        ) : (
          <ChevronDown className="h-4 w-4 text-white/70" />
        )}
      </button>
      {open && <div className="mt-4 space-y-4">{children}</div>}
    </section>
  );
}
