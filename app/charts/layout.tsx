// app/charts/layout.tsx
import type { ReactNode } from "react";
import AppShell from "@/components/ui/AppShell";
import ArtistSidebar from "@/components/nav/ArtistSidebar";

export default function ChartsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)] text-[var(--text-primary)] selection:bg-[var(--accent)] selection:text-black font-sans transition-colors">
      <ArtistSidebar />

      <main className="relative flex-1 overflow-y-auto">
        <AppShell className="bg-transparent" innerClassName="gap-6 px-6 py-8" maxWidth="full" fullHeight>
          {children}
        </AppShell>
      </main>
    </div>
  );
}
