"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/artist/projects");
  }, [router]);

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-[#0b0b0b] text-white">
      <div className="text-center space-y-4 px-4">
        <Link
          href="/artist/projects"
          className="tekkin-glitch inline-block text-5xl font-black tracking-[0.4em] sm:text-6xl"
          data-text="Tekkin"
        >
          Tekkin
        </Link>
        <p className="text-sm uppercase text-zinc-400 tracking-[0.4em]">passaggio automatico</p>
        <p className="text-zinc-500 text-xs tracking-[0.4em]">se la redirezione non avviene clicca sul logo</p>
      </div>
    </main>
  );
}
