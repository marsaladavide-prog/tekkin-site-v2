"use client";
import { Card, CardContent } from "@/components/ui/card";
import { useRouter } from "next/navigation";

export default function PressKitCard() {
  const router = useRouter();
  return (
    <Card className="relative z-10 bg-[#0f0f0f] border border-[#00ffff55] mb-6 hover:bg-[#111] transition">
      <CardContent className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Press Kit</h3>
          <p className="text-sm text-zinc-400">
            Completa bio, social, foto/video. Look & feel Tekkin — glitch underground.
          </p>
        </div>
        <button
          onClick={() => router.push("/mentoring-pro/press-kit")}
          className="px-4 py-2 rounded-md bg-[#00ffff22] hover:bg-[#00ffff44] text-cyan-300 font-semibold"
        >
          Apri Press Kit
        </button>
      </CardContent>
    </Card>
  );
}
