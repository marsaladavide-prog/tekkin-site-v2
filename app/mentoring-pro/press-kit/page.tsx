"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function PressKitPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    instagram: "",
    spotify: "",
    soundcloud: "",
    beatport: "",
    presskit_link: "",
    bio: "",
    photo_url: "",
    video_url: "",
  });

  useEffect(() => {
    const load = async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        window.location.href = "/mentoring-pro/login";
        return;
      }
      setUser(u.user);

      const { data: prof } = await supabase
        .from("users_profile")
        .select("*")
        .eq("id", u.user.id)
        .single();

      if (prof) {
        setForm({
          instagram: prof.instagram ?? "",
          spotify: prof.spotify ?? "",
          soundcloud: prof.soundcloud ?? "",
          beatport: prof.beatport ?? "",
          presskit_link: prof.presskit_link ?? "",
          bio: prof.bio ?? "",
          photo_url: prof.photo_url ?? "",
          video_url: prof.video_url ?? "",
        });
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  };

  const uploadToBucket = async (file: File, folder: string) => {
    if (!user) return "";
    const key = `${folder}/${user.id}_${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage.from("presskit").upload(key, file, { upsert: true });
    if (error) throw error;
    const pub = supabase.storage.from("presskit").getPublicUrl(data.path);
    return pub.data.publicUrl;
  };

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      setSaving(true);
      const url = await uploadToBucket(f, "photos");
      setForm((s) => ({ ...s, photo_url: url }));
      setMsg("Foto caricata ✅");
    } catch (err: any) {
      setMsg("Errore upload foto: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const onVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      setSaving(true);
      const url = await uploadToBucket(f, "videos");
      setForm((s) => ({ ...s, video_url: url }));
      setMsg("Video caricato ✅");
    } catch (err: any) {
      setMsg("Errore upload video: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    if (!user) return;
    if (form.bio && form.bio.length < 50) {
      setMsg("La bio deve contenere almeno 50 caratteri.");
      return;
    }
    if (form.bio && form.bio.length > 800) {
      setMsg("La bio supera 800 caratteri.");
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      await supabase.from("users_profile").upsert({
        id: user.id,
        instagram: form.instagram,
        spotify: form.spotify,
        soundcloud: form.soundcloud,
        beatport: form.beatport,
        presskit_link: form.presskit_link,
        bio: form.bio,
        photo_url: form.photo_url,
        video_url: form.video_url,
        updated_at: new Date().toISOString(),
      });
      setMsg("Press Kit salvato ✅");
    } catch (e: any) {
      setMsg("Errore salvataggio: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#0b0b0b] text-zinc-400">
        Caricamento Press Kit...
      </main>
    );

  return (
    <main className="relative min-h-screen bg-[#0b0b0b] text-zinc-200 px-5 py-8 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none animate-scanlines bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.04),rgba(255,255,255,0.04)_1px,transparent_2px,transparent_4px)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(67,255,210,0.05)_0%,transparent_70%)] animate-pulse opacity-40" />

      <motion.div
        className="relative z-10 mb-8"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-3xl font-extrabold gradText">Press Kit</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Bio, social e media — stile Tekkin.
        </p>
      </motion.div>

      <div className="relative z-10 grid lg:grid-cols-2 gap-6">
        {/* Social & Links */}
        <Card className="bg-[#111] border border-[#00ffff55]">
          <CardContent className="p-6 space-y-4">
            <h3 className="text-lg font-semibold">Social & Links</h3>
            <div className="grid md:grid-cols-2 gap-3">
              <input name="instagram" placeholder="Instagram (obbligatorio)" className="inputTekkin" value={form.instagram} onChange={handleChange} />
              <input name="spotify" placeholder="Spotify (obbligatorio)" className="inputTekkin" value={form.spotify} onChange={handleChange} />
              <input name="soundcloud" placeholder="SoundCloud" className="inputTekkin" value={form.soundcloud} onChange={handleChange} />
              <input name="beatport" placeholder="Beatport" className="inputTekkin" value={form.beatport} onChange={handleChange} />
              <input name="presskit_link" placeholder="Link Drive Press Kit (opzionale)" className="inputTekkin md:col-span-2" value={form.presskit_link} onChange={handleChange} />
            </div>
          </CardContent>
        </Card>

        {/* Bio */}
        <Card className="bg-[#111] border border-[#00ffff55]">
          <CardContent className="p-6 space-y-4">
            <h3 className="text-lg font-semibold">Bio</h3>
            <textarea
              name="bio"
              placeholder="Bio artista (min 50 - max 800 caratteri)"
              className="inputTekkin h-40 w-full resize-none"
              value={form.bio}
              onChange={handleChange}
            />
            <p className="text-xs text-zinc-500">
              {form.bio?.length || 0}/800
            </p>
          </CardContent>
        </Card>

        {/* Media */}
        <Card className="bg-[#111] border border-[#00ffff55] lg:col-span-2">
          <CardContent className="p-6 space-y-4">
            <h3 className="text-lg font-semibold">Media</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-2">📸 Foto artista</label>
                <input type="file" accept="image/*" onChange={onPhoto} className="fileTekkin" />
                {!form.photo_url && (
                  <p className="text-xs text-zinc-500 mt-1">
                    ⚠️ Consigliata una foto professionale frontale.
                  </p>
                )}
                {form.photo_url && (
                  <a href={form.photo_url} target="_blank" className="text-cyan-300 text-sm underline mt-2 inline-block">
                    Vedi foto caricata
                  </a>
                )}
              </div>

              <div>
                <label className="block text-sm mb-2">🎥 Video mentre suoni</label>
                <input type="file" accept="video/*" onChange={onVideo} className="fileTekkin" />
                {!form.video_url && (
                  <p className="text-xs text-zinc-500 mt-1">
                    ⚠️ Carica un breve video live/DJ set (anche verticale va bene).
                  </p>
                )}
                {form.video_url && (
                  <a href={form.video_url} target="_blank" className="text-cyan-300 text-sm underline mt-2 inline-block">
                    Vedi video caricato
                  </a>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative z-10 flex items-center justify-end mt-6">
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded-md bg-[#00ffff22] hover:bg-[#00ffff44] text-cyan-300 font-semibold"
        >
          {saving ? "Salvataggio..." : "Salva Press Kit"}
        </button>
      </div>

      {msg && (
        <div className="relative z-10 mt-4 text-center text-sm text-cyan-300">
          {msg}
        </div>
      )}

      <style jsx>{`
        @keyframes scanlines { 0%{background-position:0 0} 100%{background-position:0 4px} }
        .animate-scanlines { animation: scanlines .15s linear infinite; background-size:100% 4px; }
        .gradText { background:linear-gradient(90deg,#00ffff,#ff00ff); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
        .inputTekkin { background:#0b0b0b; border:1px solid #00ffff33; border-radius:8px; padding:10px 14px; width:100%; color:#e4e4e7; outline:none; transition:all .2s; font-size:14px; }
        .inputTekkin:focus { border-color:#00ffffaa; background:#111; }
        .fileTekkin { background:#0b0b0b; border:1px solid #00ffff33; padding:6px; border-radius:8px; width:100%; color:#a1a1aa; }
      `}</style>
    </main>
  );
}
