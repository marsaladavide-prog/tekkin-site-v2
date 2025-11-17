"use client";

import SoundCloudLikePlayer from "../components/SoundCloudLikePlayer";

export default function TestPlayerPage() {
  return (
    <main className="min-h-screen bg-zinc-900 text-zinc-100 p-10">
      <h1 className="text-2xl font-bold mb-4">Test Player</h1>
      <SoundCloudLikePlayer
        audioUrl="/audio/test.mp3"
        title="Test Locale"
        artist="Davide"
      />
    </main>
  );
}
