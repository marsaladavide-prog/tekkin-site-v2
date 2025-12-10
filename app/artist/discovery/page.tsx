"use client";

import { useState } from "react";
import { Circuit } from "./components/Circuit";
import { Scanner } from "./components/Scanner";
import { Signals } from "./components/Signals";

type TabKey = "circuit" | "signals" | "scanner";

const tabs: { key: TabKey; label: string }[] = [
  { key: "circuit", label: "Circuit" },
  { key: "signals", label: "Signals" },
  { key: "scanner", label: "Scanner" },
];

export default function DiscoveryPage() {
  const [tab, setTab] = useState<TabKey>("circuit");

  return (
    <main className="flex-1 min-h-screen bg-tekkin-bg px-6 py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="space-y-3 text-center md:text-left">
          <h1 className="text-3xl font-extrabold tracking-tight text-tekkin-text">
            Discovery
          </h1>
          <p className="text-sm text-tekkin-muted">
            Circuito Tekkin per trovare artisti, scambi promo e nuove collab.
          </p>
        </header>

        <div className="flex flex-wrap gap-2">
          {tabs.map((item) => {
            const isActive = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  isActive
                    ? "bg-white text-tekkin-text shadow-lg"
                    : "border border-tekkin-border text-tekkin-muted hover:border-white hover:text-tekkin-text"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <section className="space-y-6">
          {tab === "circuit" && <Circuit />}
          {tab === "signals" && <Signals />}
          {tab === "scanner" && <Scanner />}
        </section>
      </div>
    </main>
  );
}
