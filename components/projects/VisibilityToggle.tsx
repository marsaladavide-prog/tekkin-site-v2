"use client";

import { useMemo, useState } from "react";

const OPTIONS = [
  { value: "public", label: "Pubblico" },
  { value: "private_with_secret_link", label: "Link segreto" },
] as const;

export type VisibilityValue = (typeof OPTIONS)[number]["value"];

export default function VisibilityToggle(props: {
  value: VisibilityValue | null;
  disabled?: boolean;
  onChange: (next: VisibilityValue) => Promise<void> | void;
}) {
  const { value, disabled, onChange } = props;
  const [pending, setPending] = useState<VisibilityValue | null>(null);

  const current = value ?? "private_with_secret_link";
  const isBusy = pending !== null;

  const label = useMemo(() => {
    const found = OPTIONS.find((o) => o.value === current);
    return found?.label ?? "Link segreto";
  }, [current]);

  return (
    <div className="flex items-center gap-2">
      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/70">
        Visibilita
      </span>

      {/* mobile */}
      <div className="sm:hidden">
        <select
          value={current}
          disabled={disabled || isBusy}
          onChange={async (e) => {
            const next = e.target.value as VisibilityValue;
            setPending(next);
            try {
              await onChange(next);
            } finally {
              setPending(null);
            }
          }}
          className="h-8 rounded-full border border-white/12 bg-black/40 px-3 text-[11px] text-white outline-none focus:border-[var(--accent)]"
        >
          {OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* desktop */}
      <div className="hidden sm:inline-flex overflow-hidden rounded-full border border-white/12 bg-white/5">
        {OPTIONS.map((o) => {
          const active = current === o.value;
          return (
            <button
              key={o.value}
              type="button"
              disabled={disabled || isBusy}
              onClick={async () => {
                if (o.value === current) return;
                setPending(o.value);
                try {
                  await onChange(o.value);
                } finally {
                  setPending(null);
                }
              }}
              className={[
                "px-3 py-1 text-[11px] font-semibold transition",
                active ? "bg-[var(--accent)] text-black" : "text-white/75 hover:text-white",
                disabled || isBusy ? "opacity-60" : "",
              ].join(" ")}
              aria-pressed={active}
              title={active ? `Attuale: ${o.label}` : `Imposta: ${o.label}`}
            >
              {pending === o.value ? "Salvo..." : o.label}
            </button>
          );
        })}
      </div>

      <span className="text-[10px] text-white/50">{label}</span>
    </div>
  );
}
