"use client";

import SoundCloudLikePlayer from "./SoundCloudLikePlayer";

export default function QuickAddPlayer() {
  return (
    <section className="w-full max-w-5xl mx-auto flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg md:text-xl font-semibold">
          Player rapido
        </h2>
        <p className="text-xs md:text-sm text-zinc-400">
          Carica una traccia, rinominala e ascoltala direttamente qui.
        </p>
      </div>

      <SoundCloudLikePlayer
        audioUrl=""
        title="Nuova traccia"
        artist=""
        genre="Minimal / Deep Tech"
        initialComments={[]}
        allowRateChange
        allowLoop
      />
    </section>
  );
}
