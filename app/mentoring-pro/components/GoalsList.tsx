"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function GoalsList() {
  const [goals, setGoals] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", u.user.id)
        .order("created_at");
      setGoals(data || []);
    })();
  }, []);

  if (!goals.length) return null;

  return (
    <section className="rounded-2xl border border-[#e8ecef] bg-white/90 p-4 shadow-[0_4px_18px_rgba(0,0,0,0.06)]">
      <h3 className="text-lg font-semibold text-zinc-900 mb-3">Obiettivi</h3>
      <div className="space-y-2">
        {goals.map(g => (
          <div key={g.id} className="flex items-center justify-between border border-[#eef1f4] bg-white rounded-xl px-3 py-2">
            <div>
              <div className="font-medium text-zinc-900">{g.label}</div>
              <div className="text-xs text-zinc-500">{g.due_date || "Senza scadenza"}</div>
            </div>
            <div className="text-sm text-zinc-800">{g.progress ?? 0}%</div>
          </div>
        ))}
      </div>
    </section>
  );
}
