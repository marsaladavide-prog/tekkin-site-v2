"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Plus, Save, Trash2, CheckCircle2, XCircle, Loader2 } from "lucide-react";

/** Tipi minimi */
type Profile = { id: string; artist_name: string | null; role: string | null };
type ClientRow = { id: string; user_id: string; active: boolean; users_profile: Profile | null };
type Cycle = { id?: string; user_id?: string; month_start: string; month_end?: string | null; paid: boolean; notes?: string | null };
type Goal = { id?: string; user_id?: string; label: string; due_date?: string | null; progress?: number; done?: boolean };

/** Helper date */
const pad = (n: number) => String(n).padStart(2, "0");
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const firstOfCurrentMonth = () => {
  const d = new Date();
  return isoDate(new Date(d.getFullYear(), d.getMonth(), 1));
};

export default function AdminBackofficePage() {
  const [gate, setGate] = useState<"loading" | "no-user" | "no-role" | "ok" | "error">("loading");
  const [gateMsg, setGateMsg] = useState("");
  const [meId, setMeId] = useState<string | null>(null);

  // elenco clienti
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  // dati del cliente selezionato
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [cycleLoading, setCycleLoading] = useState(false);
  const [cycleSaving, setCycleSaving] = useState(false);

  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(false);
  const [goalsSavingId, setGoalsSavingId] = useState<string | number | null>(null);

  // GATE: solo admin o mentor
  useEffect(() => {
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) {
          setGate("no-user");
          return;
        }
        setMeId(u.user.id);

        const { data: prof, error } = await supabase
          .from("users_profile")
          .select("role")
          .eq("id", u.user.id)
          .single();

        if (error) {
          setGate("error");
          setGateMsg(error.message);
          return;
        }

        if (!prof || !["admin", "mentor"].includes(prof.role as any)) {
          setGate("no-role");
          return;
        }

        setGate("ok");
      } catch (e: any) {
        setGate("error");
        setGateMsg(String(e?.message || e));
      }
    })();
  }, []);

  // carica lista clienti attivi
  useEffect(() => {
    if (gate !== "ok") return;
    (async () => {
      const { data, error } = await supabase
        .from("users_profile")
        .select("id,user_id,active,users_profile(id,artist_name,role)")
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (!error && data) {
        setClients(data as any);
        if (data.length && !selectedUser) setSelectedUser(data[0].user_id);
      }
    })();
  }, [gate]);

  // carica ciclo mensile del cliente selezionato
  useEffect(() => {
    if (!selectedUser) return;
    setCycleLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("mentoring_cycles")
        .select("*")
        .eq("user_id", selectedUser)
        .order("month_start", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error(error);
        setCycle({
          month_start: firstOfCurrentMonth(),
          paid: false,
          notes: "",
        });
      } else if (data) {
        setCycle({
          id: data.id,
          user_id: data.user_id,
          month_start: data.month_start,
          month_end: data.month_end,
          paid: data.paid,
          notes: data.notes,
        });
      } else {
        setCycle({
          month_start: firstOfCurrentMonth(),
          paid: false,
          notes: "",
        });
      }
      setCycleLoading(false);
    })();
  }, [selectedUser]);

  // carica goals del cliente selezionato
  useEffect(() => {
    if (!selectedUser) return;
    setGoalsLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", selectedUser)
        .order("created_at");
      if (!error && data) setGoals(data as any);
      setGoalsLoading(false);
    })();
  }, [selectedUser]);

  const staffName = useMemo(() => {
    const c = clients.find((x) => x.user_id === selectedUser);
    return c?.users_profile?.artist_name || selectedUser?.slice(0, 8) || "";
  }, [clients, selectedUser]);

  // salva ciclo
  const saveCycle = async () => {
    if (!selectedUser || !cycle) return;
    setCycleSaving(true);
    const payload = { ...cycle, user_id: selectedUser };
    const req = cycle.id
      ? supabase.from("mentoring_cycles").update(payload).eq("id", cycle.id).select().single()
      : supabase.from("mentoring_cycles").insert(payload).select().single();

    const { data, error } = await req;
    setCycleSaving(false);
    if (error) {
      alert("Errore salvataggio ciclo: " + error.message);
      return;
    }
    setCycle({
      id: data!.id,
      user_id: data!.user_id,
      month_start: data!.month_start,
      month_end: data!.month_end,
      paid: data!.paid,
      notes: data!.notes,
    });
  };

  // gestione goals CRUD
  const addGoal = () => {
    setGoals((prev) => [...prev, { label: "Nuovo obiettivo", progress: 0, done: false }]);
  };

  const saveGoal = async (i: number) => {
    if (!selectedUser) return;
    const row = goals[i];
    const payload = { ...row, user_id: selectedUser, progress: row.progress ?? 0, done: !!row.done };
    setGoalsSavingId(row.id ?? i);
    const req = row.id
      ? supabase.from("goals").update(payload).eq("id", row.id as string).select().single()
      : supabase.from("goals").insert(payload).select().single();
    const { data, error } = await req;
    setGoalsSavingId(null);
    if (error) {
      alert("Errore salvataggio obiettivo: " + error.message);
      return;
    }
    setGoals((prev) => {
      const cp = [...prev];
      cp[i] = data as any;
      return cp;
    });
  };

  const deleteGoal = async (i: number) => {
    const row = goals[i];
    if (row.id) {
      const { error } = await supabase.from("goals").delete().eq("id", row.id);
      if (error) {
        alert("Errore eliminazione obiettivo: " + error.message);
        return;
      }
    }
    setGoals((prev) => prev.filter((_, idx) => idx !== i));
  };

  // UI helper
  const Section = (props: any) => (
    <section className="mb-6 rounded-2xl border border-[#111718] p-4 bg-[#0a0e0f]">{props.children}</section>
  );
  const Label = ({ children }: { children: any }) => (
    <label className="block text-xs text-zinc-400 mb-1">{children}</label>
  );

  // Gate UI
  if (gate === "loading") return GateBox("Carico...");
  if (gate === "no-user") return GateBox("Non sei loggato. Vai su /mentoring-pro/login, accedi, poi torna qui.");
  if (gate === "no-role") return GateBox("Il tuo profilo non è admin o mentor. In Supabase imposta users_profile.role = 'admin'.");
  if (gate === "error") return GateBox("Errore: " + gateMsg);

  // Admin UI
  return (
    <main className="min-h-screen bg-[#0b0b0b] text-zinc-200 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <h1 className="text-3xl font-bold">Mentoring Backoffice</h1>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-zinc-400">Logged: {meId?.slice(0, 8)}...</span>
        </div>
      </div>

      {/* Barra cliente */}
      <Section>
        <div className="grid md:grid-cols-3 gap-3 items-end">
          <div className="md:col-span-2">
            <Label>Cliente attivo</Label>
            <select
              value={selectedUser ?? ""}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full rounded border border-[#1c2628] bg-[#0f1516] px-3 py-2"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.user_id}>
                  {c.users_profile?.artist_name || c.user_id}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-1">
            <div className="text-sm text-zinc-400">Selezionato: <b>{staffName}</b></div>
          </div>
        </div>
      </Section>

      {/* Ciclo mensile */}
      <Section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">Ciclo mensile</h2>
          <button
            onClick={saveCycle}
            disabled={cycleSaving || cycleLoading}
            className="inline-flex items-center gap-2 rounded-md bg-[#43FFD2] px-3 py-2 text-black"
          >
            {cycleSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save size={16} />}
            {cycleSaving ? "Salvo..." : "Salva"}
          </button>
        </div>

        {cycleLoading ? (
          <div className="text-sm text-zinc-400">Carico...</div>
        ) : (
          <>
            <div className="grid md:grid-cols-4 gap-3">
              <div>
                <Label>Data inizio mese</Label>
                <input
                  type="date"
                  className="w-full rounded border border-[#1c2628] bg-[#0f1516] px-3 py-2"
                  value={cycle?.month_start || ""}
                  onChange={(e) => setCycle((c) => (c ? { ...c, month_start: e.target.value } : c))}
                />
              </div>
              <div>
                <Label>Data fine mese (opz.)</Label>
                <input
                  type="date"
                  className="w-full rounded border border-[#1c2628] bg-[#0f1516] px-3 py-2"
                  value={cycle?.month_end || ""}
                  onChange={(e) => setCycle((c) => (c ? { ...c, month_end: e.target.value || null } : c))}
                />
              </div>
              <div className="flex items-end">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!cycle?.paid}
                    onChange={(e) => setCycle((c) => (c ? { ...c, paid: e.target.checked } : c))}
                  />
                  <span className="select-none">Pagato</span>
                </label>
              </div>
            </div>

            <div className="mt-3">
              <Label>Note</Label>
              <textarea
                className="w-full min-h-28 rounded border border-[#1c2628] bg-[#0f1516] px-3 py-2"
                placeholder="Note sul mese, focus, accordi"
                value={cycle?.notes || ""}
                onChange={(e) => setCycle((c) => (c ? { ...c, notes: e.target.value } : c))}
              />
            </div>
          </>
        )}
      </Section>

      {/* Obiettivi */}
      <Section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">Obiettivi</h2>
          <button
            onClick={addGoal}
            className="inline-flex items-center gap-2 rounded-md bg-[#43FFD2] px-3 py-2 text-black"
          >
            <Plus size={16} /> Nuovo
          </button>
        </div>

        {goalsLoading ? (
          <div className="text-sm text-zinc-400">Carico...</div>
        ) : goals.length === 0 ? (
          <div className="text-sm text-zinc-400">Nessun obiettivo.</div>
        ) : (
          <div className="space-y-3">
            {goals.map((g, i) => (
              <div key={g.id ?? i} className="grid md:grid-cols-7 gap-2 items-center bg-[#0f1516] p-3 rounded border border-[#1c2628]">
                <input
                  className="md:col-span-3 rounded bg-black/30 px-2 py-1 border border-[#1c2628]"
                  value={g.label || ""}
                  onChange={(e) => setGoals((prev) => { const cp = [...prev]; cp[i] = { ...cp[i], label: e.target.value }; return cp; })}
                />
                <input
                  type="date"
                  className="rounded bg-black/30 px-2 py-1 border border-[#1c2628]"
                  value={g.due_date || ""}
                  onChange={(e) => setGoals((prev) => { const cp = [...prev]; cp[i] = { ...cp[i], due_date: e.target.value || null }; return cp; })}
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="rounded bg-black/30 px-2 py-1 border border-[#1c2628]"
                  value={g.progress ?? 0}
                  onChange={(e) => setGoals((prev) => { const cp = [...prev]; cp[i] = { ...cp[i], progress: Number(e.target.value) || 0 }; return cp; })}
                />
                <label className="inline-flex items-center justify-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!g.done}
                    onChange={(e) => setGoals((prev) => { const cp = [...prev]; cp[i] = { ...cp[i], done: e.target.checked }; return cp; })}
                  />
                  <span className="text-sm">Done</span>
                </label>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => saveGoal(i)}
                    className="rounded bg-[#122] px-3 py-1 border border-[#1c2628] inline-flex items-center gap-2"
                    disabled={goalsSavingId === (g.id ?? i)}
                    title="Salva"
                  >
                    {goalsSavingId === (g.id ?? i) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save size={16} />}
                    Salva
                  </button>
                  <button
                    onClick={() => deleteGoal(i)}
                    className="rounded bg-[#221] px-3 py-1 border border-[#1c2628]"
                    title="Elimina"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Stato footer */}
      <div className="mt-4 text-xs text-zinc-500 flex items-center gap-3">
        <span className="inline-flex items-center gap-1">
          <CheckCircle2 size={14} className="text-emerald-400" /> RLS attiva
        </span>
        <span className="inline-flex items-center gap-1">
          <XCircle size={14} className="text-yellow-400" /> Ricorda: users_profile senza RLS o con policy corrette
        </span>
      </div>
    </main>
  );
}

function GateBox(text: string) {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0b0b0b", color: "#eee" }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Mentoring Backoffice</h1>
        <p>{text}</p>
      </div>
    </main>
  );
}
