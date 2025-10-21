"use client";
import GlitchAvatar from "@/components/GlitchAvatar";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function IntroModal({ user, setShowIntro }: any) {
  const [basic, setBasic] = useState({ name: "", surname: "", artist_name: "" });
  const [pickVariant, setPickVariant] = useState(0);
  const [pickSeed, setPickSeed] = useState(user?.id || "");

  const saveIntro = async () => {
    await supabase.from("users_profile").upsert({
      id: user.id,
      name: basic.name,
      surname: basic.surname,
      artist_name: basic.artist_name,
      avatar_variant: pickVariant,
      avatar_seed: pickSeed,
      basic_completed: true,
      updated_at: new Date().toISOString(),
    });
    setShowIntro(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-2xl border border-[#00ffff88] bg-[#0b0b0b] shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-[#00ffff33]">
          <h2 className="text-2xl font-extrabold gradText glitch-title">
            Benvenuto nel Mentoring Pro
          </h2>
          <p className="text-zinc-400 text-sm mt-1">
            Setta profilo base e scegli il tuo avatar Tekkin.
          </p>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid md:grid-cols-2 gap-3">
            <input
              className="inputTekkin"
              placeholder="Nome"
              value={basic.name}
              onChange={(e) => setBasic({ ...basic, name: e.target.value })}
            />
            <input
              className="inputTekkin"
              placeholder="Cognome"
              value={basic.surname}
              onChange={(e) => setBasic({ ...basic, surname: e.target.value })}
            />
            <input
              className="inputTekkin md:col-span-2"
              placeholder="Nome d’arte"
              value={basic.artist_name}
              onChange={(e) => setBasic({ ...basic, artist_name: e.target.value })}
            />
          </div>

          <div>
            <p className="text-sm text-zinc-400 mb-2">Avatar Tekkin (scegline uno)</p>
            <div className="flex items-center gap-2 flex-wrap">
              {[0, 1, 2, 3, 4].map((v) => (
                <button
                  key={v}
                  onClick={() => setPickVariant(v)}
                  className={`p-1 rounded-lg border transition-all ${
                    pickVariant === v
                      ? "border-cyan-400 bg-[#00ffff22]"
                      : "border-[#00ffff33]"
                  }`}
                >
                  <GlitchAvatar size={72} variant={v} seed={pickSeed || "tekkin"} />
                </button>
              ))}
              <input
                className="inputTekkin w-40"
                placeholder="seed (opzionale)"
                value={pickSeed}
                onChange={(e) => setPickSeed(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={saveIntro}
              className="px-4 py-2 rounded-md bg-[#00ffff22] hover:bg-[#00ffff44] text-cyan-300 font-semibold"
            >
              Salva e continua
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
