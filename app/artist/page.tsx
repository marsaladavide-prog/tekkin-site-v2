"use client";

import { useEffect, useState } from "react";
import { ArtistHero } from "./components/ArtistHero";
import { TekkinRankSection } from "./components/TekkinRankSection";
import { ArtistSelection } from "./components/ArtistSelection";
import { ReleasesHighlights } from "./components/ReleasesHighlights";
import { UnreleasedLab } from "./components/UnreleasedLab";
import { InstagramFeed } from "./components/InstagramFeed";

export default function ArtistPage() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const toggleTheme = () => {
    const html = document.documentElement;
    const nowDark = !html.classList.contains("dark");
    html.classList.toggle("dark");
    setIsDark(nowDark);
  };

  return (
    <div className="relative min-h-full bg-[#0b0b0c] text-white selection:bg-[#06b6d4] selection:text-black">
      <div className="pointer-events-none fixed inset-0 bg-grid-pattern opacity-[0.03]" />

      <div className="relative mx-auto flex min-h-full max-w-6xl flex-col gap-10 px-6 py-12">
        <ArtistHero isDark={isDark} onToggleTheme={toggleTheme} />
        <TekkinRankSection />
        <ArtistSelection />
        <ReleasesHighlights />
        <UnreleasedLab />
        <InstagramFeed />
        <div className="h-4" />
      </div>
    </div>
  );
}
