"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Splash from "@/components/core/Splash";

export default function HomePage() {
  const pathname = usePathname();
  const [showSplash, setShowSplash] = useState(true);

useEffect(() => {
  if (pathname !== "/") {
    setShowSplash(false);
    return;
  }

  // ogni volta che torni su "/", mostra lo splash
  setShowSplash(true);
  const t = setTimeout(() => setShowSplash(false), 2500);
  return () => clearTimeout(t);
}, [pathname]);

  if (showSplash && pathname === "/") return <Splash onDone={() => setShowSplash(false)} />;

  return (
    <main className="relative min-h-screen bg-[#0b0b0b] text-zinc-200 flex flex-col items-center justify-center overflow-hidden">
      {/* === SFONDO IDENTICO A SPLASH === */}
      <div className="absolute inset-0">
        {/* righe orizzontali in movimento */}
        <div className="absolute inset-0 pointer-events-none animate-scanlines bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.04),rgba(255,255,255,0.04)_1px,transparent_2px,transparent_4px)]"></div>
        {/* bagliore radiale centrale */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(67,255,210,0.05)_0%,transparent_70%)] animate-pulse opacity-40"></div>
      </div>

      {/* === CONTENUTO === */}
      <h1 className="text-4xl font-bold tracking-[0.2em] mb-6 z-10">TEKKIN</h1>
      <p className="text-zinc-400 mb-8 text-center max-w-lg z-10">
        Analyzer Pro — Sample Packs — Dashboard
      </p>

      <div className="flex flex-wrap justify-center gap-4 z-10">
       
        <a
          href="/analyzer"
          className="border border-[#222] rounded-md px-6 py-3 hover:bg-[#111]"
        >
          Analyzer Pro
        </a>

        <a
          href="/sample-packs"
          className="border border-[#222] rounded-md px-6 py-3 hover:bg-[#111]"
        >
          Sample Packs
        </a>

        <a
          href="/news"
          className="border border-[#222] rounded-md px-6 py-3 hover:bg-[#111]"
        >
          News & Tips
        </a>

        <a
          href="/artist"
          className="border border-[#222] rounded-md px-6 py-3 hover:bg-[#111]"
        >
          Artist
        </a>

                <a
          href="/agent-dm"
          className="border border-[#222] rounded-md px-6 py-3 hover:bg-[#111]"
        >
          Agent
        </a>
      </div>

      {/* === ANIMAZIONE SCANLINES === */}
      <style jsx>{`
        @keyframes scanlines {
          0% {
            background-position: 0 0;
          }
          100% {
            background-position: 0 4px;
          }
        }

        .animate-scanlines {
          animation: scanlines 0.15s linear infinite;
          background-size: 100% 4px;
        }
      `}</style>
    </main>
  );
}
