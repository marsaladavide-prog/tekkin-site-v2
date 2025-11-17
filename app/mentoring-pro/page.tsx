"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  LogOut,
  Settings,
  CheckCircle2,
  CalendarDays,
  Music2,
  Target,
  Sparkles,
  BadgeEuro,
  User2,
  Info,
} from "lucide-react";
import Image from "next/image";
import GlitchAvatar from "@/components/GlitchAvatar";

import TracksSection from "./components/TracksSection";
import ProgressCharts from "./components/ProgressCharts";
import CalendarSection from "./components/CalendarSection";
import PressKitCard from "./components/PressKitCard";
import IntroModal from "./components/IntroModal";
import SoundCloudLikePlayer from "./components/SoundCloudLikePlayer";

type Profile = {
  id: string;
  artist_name: string | null;
  photo_url: string | null;
  avatar_seed?: string | null;
  avatar_variant?: number | null;
  basic_completed?: boolean | null;
};

type Cycle = {
  month_start: string;
  month_end?: string | null;
  paid: boolean;
  notes?: string | null;
};

type Goal = {
  id: string;
  label: string;
  due_date: string | null;
  progress: number | null;
  done: boolean | null;
};

export default function MentoringProPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showIntro, setShowIntro] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Usa sessione cookie based
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;

      if (!session) {
        router.replace("/mentoring-pro/login?next=/mentoring-pro");
        return;
      }

      if (cancelled) return;
      const userId = session.user.id;
      setUser(session.user);

      const [{ data: prof }, { data: cy }, { data: gs }] = await Promise.all([
        supabase
          .from("users_profile")
          .select("id,artist_name,photo_url,avatar_seed,avatar_variant,basic_completed")
          .eq("id", userId)
          .single(),
        supabase
          .from("mentoring_cycles")
          .select("month_start,month_end,paid,notes")
          .eq("user_id", userId)
          .order("month_start", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("goals")
          .select("id,label,due_date,progress,done")
          .eq("user_id", userId)
          .order("created_at"),
      ]);

      if (cancelled) return;
      setProfile((prof as any) || null);
      setCycle((cy as any) || null);
      setGoals((gs as any) || []);
      if (!(prof as any)?.basic_completed) setShowIntro(true);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [router]);

  const paidBadge = useMemo(() => {
    if (!cycle) return null;
    return (
      <div
        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${
          cycle.paid
            ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
            : "bg-amber-100 text-amber-700 border-amber-200"
        }`}
      >
        <BadgeEuro className="h-4 w-4" /> {cycle.paid ? "Pagato" : "In attesa"}
      </div>
    );
  }, [cycle]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/mentoring-pro/login");
  };

  if (loading) {
    return (
      <main className="min-h-screen grid place-items-center bg-[#f6f8fb] text-zinc-600">
        <div className="text-sm">Caricamento dashboard...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full bg-[radial-gradient(circle_at_15%_10%,#ffffff_0%,#f3f7fb_45%,#eaf1f6_100%)] text-zinc-900">
      {/* Top Bar */}
      <div className="sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-white/70 bg-white/90 border-b border-[#e8ecef]">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-white shadow-sm ring-1 ring-black/5 grid place-items-center">
              <Sparkles className="h-5 w-5 text-cyan-700" />
            </div>
            <div>
              <div className="text-sm text-zinc-500 leading-none">TEKKIN</div>
              <div className="font-semibold leading-none flex items-center gap-2">
                Mentoring Pro
                {paidBadge}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setSettingsOpen(true)}
              className="h-9 w-9 rounded-lg bg-white shadow-sm ring-1 ring-black/5 grid place-items-center hover:bg-zinc-50"
              title="Impostazioni"
            >
              <Settings className="h-5 w-5 text-cyan-700" />
            </button>
            <button
              onClick={handleLogout}
              className="h-9 w-9 rounded-lg bg-white shadow-sm ring-1 ring-black/5 grid place-items-center hover:bg-zinc-50"
              title="Logout"
            >
              <LogOut className="h-5 w-5 text-cyan-700" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid principale */}
      <div className="mx-auto max-w-7xl px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar sinistra */}
        <aside className="lg:col-span-3 space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="rounded-2xl bg-white/90 border border-[#e8ecef] shadow-[0_10px_30px_rgba(0,0,0,0.04)] p-4"
          >
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-cyan-200 to-purple-200 grid place-items-center ring-1 ring-black/5">
                {profile?.photo_url ? (
                  <Image
                    src={profile.photo_url}
                    alt="avatar"
                    width={48}
                    height={48}
                    className="h-12 w-12 rounded-xl object-cover"
                  />
                ) : profile?.avatar_seed ? (
                  <GlitchAvatar size={48} seed={profile.avatar_seed} variant={profile.avatar_variant ?? 0} />
                ) : (
                  <User2 className="h-6 w-6 text-cyan-900/70" />
                )}
              </div>
              <div>
                <div className="text-xs text-zinc-500">Benvenuto</div>
                <div className="font-semibold">{profile?.artist_name || user?.email}</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <MiniShortcut icon={<Music2 className="h-4 w-4" />} label="Tracce" href="#tracks" />
              <MiniShortcut icon={<Target className="h-4 w-4" />} label="Goals" href="#goals" />
              <MiniShortcut icon={<CalendarDays className="h-4 w-4" />} label="Calendario" href="#calendar" />
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="rounded-2xl bg-white/90 border border-[#e8ecef] shadow-[0_10px_30px_rgba(0,0,0,0.04)] p-4"
          >
            <div className="text-sm font-semibold mb-2">Stato pagamento</div>
            {cycle ? (
              <div className="flex items-center justify-between">
                <div className="text-sm text-zinc-600">
                  Mese da <b>{cycle.month_start}</b>
                </div>
                {paidBadge}
              </div>
            ) : (
              <div className="text-sm text-zinc-500">Dati non disponibili</div>
            )}
            {cycle?.notes ? (
              <div className="mt-3 text-xs text-zinc-500">
                <Info className="inline h-4 w-4 mr-1" />
                {cycle.notes}
              </div>
            ) : null}
          </motion.div>
          <ActivityTimeline />
        </aside>
        {/* Colonna centrale */}
        <section className="lg:col-span-6 space-y-4">
          <StudioCard id="goals" title="Obiettivi" subtitle="Il tuo focus di questo mese">
            {goals.length === 0 ? (
              <div className="text-sm text-zinc-500">
                Nessun obiettivo.
                <span className="ml-1 text-zinc-400">Chiedi al mentor di aggiungerne dal backoffice.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {goals.map((g) => (
                  <GoalRow key={g.id} g={g} />
                ))}
              </div>
            )}
          </StudioCard>
          <StudioCard title="Press Kit" subtitle="Materiale ufficiale aggiornato">
            <PressKitCard />
          </StudioCard>
          {/* Tracce: niente titolo sovrastante, solo la sezione e il player */}
          <div id="tracks" className="space-y-4">
            <TracksSection userId={user.id} />
            <StudioCard title="Aggiungi traccia">
              <SoundCloudLikePlayer />
            </StudioCard>
          </div>
        </section>
        {/* Sidebar destra */}
        <aside className="lg:col-span-3 space-y-4">
          <StudioCard title="Andamento">
            <ProgressCharts />
          </StudioCard>
          <StudioCard id="calendar" title="Calendario">
            <CalendarSection />
          </StudioCard>
          <div className="rounded-2xl bg-gradient-to-b from-white to-[#f7fbff] border border-[#e8ecef] shadow-[0_10px_30px_rgba(0,0,0,0.04)] p-4">
            <div className="text-sm font-semibold mb-1">Suggerimento veloce</div>
            <div className="text-xs text-zinc-600">
              Mantieni il kick tra -11 dB e -9.5 dB RMS, target LUFS -8.5 o -7.5 e lascia headroom per il master.
            </div>
          </div>
        </aside>
      </div>
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {showIntro && <IntroModal user={user} setShowIntro={setShowIntro} />}
    </main>
  );
}

/*** UI helpers ***/
function StudioCard({ id, title, subtitle, children }: { id?: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="rounded-2xl bg-white/90 border border-[#e8ecef] shadow-[0_10px_30px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-[#eef1f4] bg-white/60">
        <div className="text-sm text-zinc-500">{subtitle}</div>
        <div className="text-xl font-semibold">{title}</div>
      </div>
      <div className="px-4 pb-4">{children}</div>
    </section>
  );
}

function GoalRow({ g }: { g: { label: string; due_date: string | null; progress: number | null; done: boolean | null } }) {
  const pct = Math.min(100, Math.max(0, g.progress ?? 0));
  return (
    <div className="rounded-xl border border-[#eef1f4] bg-white p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">{g.label}</div>
          <div className="text-xs text-zinc-500">{g.due_date || "Senza scadenza"}</div>
        </div>
        <div className={`text-xs px-2 py-1 rounded-full ${g.done ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-700"}`}>
          {g.done ? "Done" : `${pct}%`}
        </div>
      </div>
      <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden">
        <div className="h-full bg-cyan-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MiniShortcut({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) {
  return (
    <a href={href} className="group rounded-xl bg-white border border-[#eef1f4] p-2 text-xs text-zinc-700 flex items-center gap-2 hover:shadow">
      <span className="grid place-items-center h-6 w-6 rounded-md bg-zinc-50 text-zinc-800">{icon}</span>
      <span className="font-medium">{label}</span>
    </a>
  );
}

function ActivityTimeline() {
  const items = [
    { id: "1", when: "Oggi", txt: "Brief del mese aggiornato dal mentor" },
    { id: "2", when: "Ieri", txt: "Caricata traccia WIP_2025_v3" },
    { id: "3", when: "3 gg fa", txt: "Aggiornati obiettivi: Mixdown e Promo" },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="rounded-2xl bg-white/90 border border-[#e8ecef] shadow-[0_10px_30px_rgba(0,0,0,0.04)] p-4"
    >
      <div className="text-sm font-semibold mb-2">Timeline attività</div>
      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.id} className="flex items-start gap-2">
            <div className="h-2 w-2 rounded-full bg-cyan-500 mt-2" />
            <div className="text-sm">
              <div className="font-medium">{it.txt}</div>
              <div className="text-xs text-zinc-500">{it.when}</div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function SettingsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{ artist_name?: string; photo_url?: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;
      if (!session) return;
      const { data: prof } = await supabase
        .from("users_profile")
        .select("artist_name,photo_url")
        .eq("id", session.user.id)
        .single();
      setForm((prof as any) || { artist_name: "", photo_url: "" });
    })();
  }, [open]);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    const { data } = await supabase.auth.getSession();
    const session = data?.session;
    if (!session) return;
    const { error } = await supabase.from("users_profile").update(form).eq("id", session.user.id);
    setSaving(false);
    if (!error) onClose();
  };

  return (
    <div className={`fixed inset-0 z-50 ${open ? "pointer-events-auto" : "pointer-events-none"}`}>
      <div className={`absolute inset-0 bg-black/40 transition-opacity ${open ? "opacity-100" : "opacity-0"}`} onClick={onClose} />
      <aside
        className={`absolute top-0 right-0 h-full w-[360px] bg-white border-l border-[#e8ecef] shadow-2xl transition-transform ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="px-4 py-3 border-b border-[#eef1f4]">
          <div className="text-sm font-semibold">Impostazioni profilo</div>
          <div className="text-xs text-zinc-500">Modifica il tuo nome e la foto profilo</div>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs text-zinc-500">Nome artista</label>
            <input
              value={form?.artist_name || ""}
              onChange={(e) => setForm((f) => ({ ...(f || {}), artist_name: e.target.value }))}
              className="w-full rounded-lg border border-[#e8ecef] bg-white px-3 py-2"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500">Foto URL</label>
            <input
              value={form?.photo_url || ""}
              onChange={(e) => setForm((f) => ({ ...(f || {}), photo_url: e.target.value }))}
              className="w-full rounded-lg border border-[#e8ecef] bg-white px-3 py-2"
            />
          </div>
        </div>
        <div className="p-4 border-t border-[#eef1f4] flex justify-end">
          <button onClick={save} disabled={saving} className="rounded-lg bg-black text-white px-4 py-2 hover:opacity-90">
            {saving ? "Salvo..." : "Salva"}
          </button>
        </div>
      </aside>
    </div>
  );
}
