"use client";
export default function PressKitCard() {
  return (
    <div className="rounded-xl border border-[#eef1f4] bg-white p-4 flex items-center justify-between">
      <div>
        <div className="text-sm font-medium">Press Kit</div>
        <div className="text-xs text-zinc-600">
          Completa bio, social, foto/video. Look & feel Tekkin in stile glitch underground.
        </div>
      </div>
      <a
        href="mentoring-pro/press-kit"
        className="rounded-lg bg-black text-white px-3 py-2 text-sm hover:opacity-90"
      >
        Apri Press Kit
      </a>
    </div>
  );
}
