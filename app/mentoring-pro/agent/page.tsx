"use client";

import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import TekkinAgentPanel from "../components/TekkinAgentPanel";

export default function TekkinAgentFullPage() {
  return (
    <main className="min-h-screen w-full bg-[radial-gradient(circle_at_15%_15%,#f8fbff_0%,#eef3f9_45%,#e6edf5_100%)] text-zinc-900">
      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-white shadow-sm ring-1 ring-black/5 grid place-items-center">
              <Sparkles className="h-5 w-5 text-cyan-700" />
            </div>
            <div>
              <div className="text-xs text-zinc-500 uppercase tracking-[0.2em]">
                Tekkin Agent
              </div>
              <div className="text-xl font-semibold">Workspace dedicato</div>
              <div className="text-sm text-zinc-600">
                Chat operativa, progetti/task e dashboard in pagina intera.
              </div>
            </div>
          </div>
          <Link
            href="/mentoring-pro"
            className="inline-flex items-center gap-2 rounded-full border border-[#e3e8ef] bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Torna alla dashboard
          </Link>
        </header>

        <TekkinAgentPanel />
      </div>
    </main>
  );
}
