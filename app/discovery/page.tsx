import { Circuit } from "@/app/artist/discovery/components/Circuit";

export default function DiscoveryPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <header className="space-y-3 text-center md:text-left">
        <p className="text-[11px] uppercase tracking-[0.4em] text-white/50">
          Tekkin Discovery
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-tekkin-text">
          Circuit
        </h1>
        <p className="text-sm text-tekkin-muted">
          Esplora la community Tekkin, filtra per genere e cerca nuovi collab.
        </p>
      </header>

      <section className="space-y-6">
        <Circuit />
      </section>
    </div>
  );
}
