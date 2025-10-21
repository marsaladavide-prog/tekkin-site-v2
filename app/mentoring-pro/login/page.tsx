"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@supabase/supabase-js";
import { Card, CardContent } from "@/components/ui/card";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function MentoringLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      if (!data.user) throw new Error("Accesso non riuscito.");

      // Verifica se il profilo è completo
      const { data: profile } = await supabase
        .from("users_profile")
        .select("completed")
        .eq("id", data.user.id)
        .single();

      if (profile?.completed) {
        router.push("/mentoring-pro/dashboard");
      } else {
        router.push("/mentoring-pro");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0b0b0b] text-zinc-200 flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <Card className="bg-[#111] border border-[#00ffff44]">
          <CardContent className="p-8 space-y-6">
            <h1 className="text-3xl font-extrabold text-center gradText mb-4">
              Accesso Mentoring Pro
            </h1>
            <p className="text-zinc-400 text-sm text-center">
              Inserisci le credenziali fornite da Tekkin.
            </p>

            <div className="space-y-4 mt-6">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="inputTekkin"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="inputTekkin"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full py-3 bg-[#00ffff33] hover:bg-[#00ffff55] text-cyan-300 font-semibold rounded-md transition mt-4"
            >
              {loading ? "Accesso in corso..." : "Accedi"}
            </button>
          </CardContent>
        </Card>
      </motion.div>

      <style jsx>{`
        .inputTekkin {
          background: #0b0b0b;
          border: 1px solid #00ffff33;
          border-radius: 8px;
          padding: 10px 14px;
          width: 100%;
          color: #e4e4e7;
          outline: none;
          transition: all 0.2s;
        }
        .inputTekkin:focus {
          border-color: #00ffffaa;
          background: #111;
        }
      `}</style>
    </main>
  );
}
