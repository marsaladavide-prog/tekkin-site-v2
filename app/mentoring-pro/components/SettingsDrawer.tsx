"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { X } from "lucide-react";

type Props = { open: boolean; onClose: () => void };
export default function SettingsDrawer({ open, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({
    artist_name: "",
    photo_url: "",
    avatar_seed: "",
    avatar_variant: 0,
    basic_completed: false,
    notifications: true
  });

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { setLoading(false); return; }
      const { data } = await supabase
        .from("users_profile")
        .select("artist_name,photo_url,avatar_seed,avatar_variant,basic_completed,notifications")
        .eq("id", u.user.id)
        .single();
      if (data)
        setForm({
          ...data,
          notifications: data.notifications ?? true,
        });
      setLoading(false);
    })();
  }, [open]);

  const save = async () => {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase
      .from("users_profile")
      .update(form)
      .eq("id", u.user.id);
    setSaving(false);
    if (error) alert(error.message);
    else onClose();
  };

  return (
    <div className={`fixed inset-0 z-50 ${open ? "pointer-events-auto" : "pointer-events-none"}`}>
      {/* backdrop */}
      <div className={`absolute inset-0 bg-black/40 transition-opacity ${open ? "opacity-100" : "opacity-0"}`} onClick={onClose} />
      {/* drawer */}
      <aside className={`absolute right-0 top-0 h-full w-[360px] bg-white text-zinc-900 shadow-[0_10px_40px_rgba(0,0,0,0.25)] 
        transition-transform ${open ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#eef1f4]">
          <div className="font-semibold">Impostazioni</div>
          <button onClick={onClose} className="p-2 rounded hover:bg-zinc-100"><X size={18} /></button>
        </div>

        <div className="p-4 space-y-3">
          {loading ? <div className="text-sm text-zinc-500">Carico…</div> : (
            <>
              <div>
                <label className="text-xs text-zinc-500">Nome artista</label>
                <input
                  value={form.artist_name || ""}
                  onChange={(e)=>setForm((f:any)=>({...f, artist_name: e.target.value}))}
                  className="w-full rounded-lg border border-[#e8ecef] bg-white px-3 py-2"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500">Foto URL</label>
                <input
                  value={form.photo_url || ""}
                  onChange={(e)=>setForm((f:any)=>({...f, photo_url: e.target.value}))}
                  className="w-full rounded-lg border border-[#e8ecef] bg-white px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-500">Avatar seed</label>
                  <input
                    value={form.avatar_seed || ""}
                    onChange={(e)=>setForm((f:any)=>({...f, avatar_seed: e.target.value}))}
                    className="w-full rounded-lg border border-[#e8ecef] bg-white px-3 py-2"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500">Variant</label>
                  <input
                    type="number"
                    value={form.avatar_variant ?? 0}
                    onChange={(e)=>setForm((f:any)=>({...f, avatar_variant: Number(e.target.value)||0}))}
                    className="w-full rounded-lg border border-[#e8ecef] bg-white px-3 py-2"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!form.basic_completed}
                  onChange={(e)=>setForm((f:any)=>({...f, basic_completed: e.target.checked}))}/>
                Onboarding completato
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!form.notifications}
                  onChange={(e)=>setForm((f:any)=>({...f, notifications: e.target.checked}))}/>
                Notifiche email
              </label>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={save}
                  className="rounded-lg bg-black text-white px-4 py-2 hover:opacity-90"
                  disabled={saving}
                >
                  {saving ? "Salvo..." : "Salva"}
                </button>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
