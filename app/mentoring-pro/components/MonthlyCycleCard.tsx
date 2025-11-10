"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Cycle = { month_start: string; month_end?: string | null; paid: boolean; notes?: string | null };

export default function MonthlyCycleCard() {
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("mentoring_cycles")
        .select("month_start,month_end,paid,notes")
        .eq("user_id", u.user.id)
        .order("month_start", { ascending: false })
        .limit(1)
        .maybeSingle();
      setCycle(data || null);
      setLoading(false);
    })();
  }, []);

  if (loading || !cycle) return null;

  return (
    <section className="rounded-2xl border border-[#e8ecef] bg-white/90 p-4 shadow-[0_4px_18px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-zinc-900">Mese attuale</h3>
        <span className={`text-xs px-2 py-1 rounded-full ${cycle.paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
          {cycle.paid ? "Pagato" : "In attesa"}
        </span>
      </div>
      <div className="mt-2 text-sm text-zinc-700">
        <div>Inizio: <b>{cycle.month_start}</b></div>
        {cycle.month_end ? <div>Fine: <b>{cycle.month_end}</b></div> : null}
        {cycle.notes ? <div className="mt-2 text-zinc-600">Note: {cycle.notes}</div> : null}
      </div>
    </section>
  );
}
