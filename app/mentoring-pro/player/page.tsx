import SoundCloudLikePlayer from "@/app/mentoring-pro/components/SoundCloudLikePlayer";

export default function PlayerPage() {
  return (
    <main className="min-h-screen bg-[#0b0b0b] text-zinc-100 p-6">
      <div className="mx-auto max-w-5xl">
        <SoundCloudLikePlayer
          audioUrl="/audio/your-track.wav"
          artworkUrl="/images/your-art.jpg"
          title="Take It Off (Original Mix)"
          artist="Davide Marsala"
          genre="Minimal / Deep Tech"
          initialComments={[
            { id: "c1", author: "Marco", text: "Groove micidiale", atSeconds: 22 },
            { id: "c2", author: "Sara", text: "Drop incredibile", atSeconds: 74 },
          ]}
          allowRateChange
          allowLoop
        />
      </div>
    </main>
  );
}
