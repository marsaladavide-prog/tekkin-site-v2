"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { type ReactNode, useState } from "react";

type AnalyzerCollapsibleSectionProps = {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

export function AnalyzerCollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: AnalyzerCollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-2xl border border-white/10 bg-black/80 p-4">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between text-left text-sm font-semibold text-white"
        aria-expanded={open}
      >
        <span>{title}</span>
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
