// app/artist/discovery/page.tsx
"use client";

import { useState } from "react";
import { Circuit } from "./components/Circuit";
import { Signals } from "./components/Signals";
import { Scanner } from "./components/Scanner";

type TabKey = "circuit" | "signals" | "scanner";

export default function DiscoveryPage() {
  const [tab, setTab] = useState<TabKey>("circuit");

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Discovery</h1>
        <span className="text-xs text-muted-foreground">
          Circuit · Signals · Scanner
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2 text-sm">
        <button
          type="button"
          onClick={() => setTab("circuit")}
          className={`px-3 py-1 rounded-md ${
            tab === "circuit"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          Circuit
        </button>
        <button
          type="button"
          onClick={() => setTab("signals")}
          className={`px-3 py-1 rounded-md ${
            tab === "signals"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          Signals
        </button>
        <button
          type="button"
          onClick={() => setTab("scanner")}
          className={`px-3 py-1 rounded-md ${
            tab === "scanner"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          Scanner
        </button>
      </div>

      {/* Content */}
      {tab === "circuit" && <Circuit />}
      {tab === "signals" && <Signals />}
      {tab === "scanner" && <Scanner />}
    </div>
  );
}
