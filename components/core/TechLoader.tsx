"use client";
import { useEffect, useState } from "react";

export default function TechLoader() {
  const texts = [
    "INITIALIZING TEKKIN ANALYZER_",
    "SYNCING LOW END_",
    "BREAKING DOWN FREQUENCIES_",
    "CALIBRATING GROOVE_",
    "LOCKING RMS_",
  ];

  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % texts.length);
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  return (
  <div className="w-full flex flex-col items-center justify-center py-10 text-[#00ffff] tracking-[0.15em] font-[Share_Tech_Mono]">
    <div className="relative w-20 h-20 mb-4 flex items-center justify-center">
      <div className="absolute inset-0 rounded-full border-2 border-[#00ffff33] animate-ping"></div>
      <div className="absolute inset-2 rounded-full border border-[#00ffff] animate-pulse shadow-[0_0_20px_#00ffff55]"></div>
    </div>

    <p className="text-sm sm:text-base text-[#9ef3f3] uppercase animate-pulse select-none">
      {texts[index]}
    </p>
  </div>
);
}
