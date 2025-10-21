"use client";

import { motion } from "framer-motion";
import { createClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Settings, LogOut } from "lucide-react";
import Image from "next/image";
import GlitchAvatar from "@/components/GlitchAvatar";

// === COMPONENTI ===
import TracksSection from "./components/TracksSection";
import MentoringStatus from "./components/MentoringStatus";
import ProgressCharts from "./components/ProgressCharts";
import CalendarSection from "./components/CalendarSection";
import PressKitCard from "./components/PressKitCard";
import IntroModal from "./components/IntroModal";


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function MentoringProPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push("/mentoring-pro/login");
        return;
      }
      setUser(userData.user);

      const { data: prof } = await supabase
        .from("users_profile")
        .select("*")
        .eq("id", userData.user.id)
        .single();

      setProfile(prof || null);
      if (!prof?.basic_completed) setShowIntro(true);
      setLoading(false);
    };
    init();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/mentoring-pro/login");
  };

  if (loading)
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#0b0b0b] text-zinc-400">
        <p>Caricamento Mentoring Pro...</p>
      </main>
    );

  return (
    <main className="relative min-h-screen bg-[#0b0b0b] text-zinc-200 px-5 py-8 overflow-hidden">
      {/* === SFONDO === */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 pointer-events-none animate-scanlines bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.04),rgba(255,255,255,0.04)_1px,transparent_2px,transparent_4px)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(67,255,210,0.05)_0%,transparent_70%)] animate-pulse opacity-40"></div>
      </div>

      {/* === HEADER === */}
      <div className="relative z-10 flex items-center justify-between mb-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-4xl font-extrabold gradText">
            Mentoring <span className="text-cyan-300">Pro</span>
          </h1>
          <p className="text-zinc-400 mt-1 text-sm">
            Benvenuto {profile?.artist_name || user.email}
          </p>
        </motion.div>

        <div className="flex items-center gap-4">
          {profile?.avatar_seed ? (
            <div className="rounded-full border border-[#00ffff55] p-[2px]">
              <GlitchAvatar
                size={44}
                seed={profile.avatar_seed}
                variant={profile.avatar_variant ?? 0}
              />
            </div>
          ) : profile?.photo_url ? (
            <Image
              src={profile.photo_url}
              alt="avatar"
              width={44}
              height={44}
              className="rounded-full border border-[#00ffff55]"
            />
          ) : (
            <div className="w-11 h-11 rounded-full bg-[#111] border border-[#00ffff44] flex items-center justify-center text-sm text-cyan-300">
              {profile?.artist_name?.[0]?.toUpperCase() || "U"}
            </div>
          )}

          <button
            onClick={() => router.push("/mentoring-pro/settings")}
            className="p-2 hover:bg-[#111] rounded-md"
          >
            <Settings className="h-5 w-5 text-cyan-300" />
          </button>
          <button onClick={handleLogout} className="p-2 hover:bg-[#111] rounded-md">
            <LogOut className="h-5 w-5 text-cyan-300" />
          </button>
        </div>
      </div>

      {/* === SEZIONI === */}
      <TracksSection />
      <MentoringStatus />
      <ProgressCharts />
      <CalendarSection />
      <PressKitCard />
      {showIntro && <IntroModal user={user} setShowIntro={setShowIntro} />}

      {/* === STILI GLOBALI === */}
      <style jsx global>{`
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
        .gradText {
          background: linear-gradient(90deg, #00ffff, #ff00ff);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
      `}</style>
    </main>
  );
}
