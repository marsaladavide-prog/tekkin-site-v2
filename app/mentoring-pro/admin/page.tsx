"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Plus, Save, Trash2, Loader2,
  ChevronLeft, ChevronRight, CalendarCheck2, Search
} from "lucide-react";

/* ===== Tipi ===== */
type LabelRow = {
  user_id: string;
  display_name: string | null;
  is_mentoring: boolean | null;
  is_staff: boolean | null;
};

type IdentityRow = {
  auth_id: string;
  email: string | null;
  profile_name: string | null;
  mentoring_id: string | null;
  is_staff: boolean | null;
  role: string | null;
};

type Cycle = { id?: string; user_id?: string; month_start: string; month_end?: string | null; paid: boolean; notes?: string | null };
type Goal = { id?: string; user_id?: string; label: string; due_date?: string | null; progress?: number; done?: boolean };

/* ===== Helpers date ===== */
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const firstOfMonth = (d = new Date()) => ymd(new Date(d.getFullYear(), d.getMonth(), 1));
const lastOfMonth  = (d = new Date()) => ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0));
const asYMD = (v?: string | null) => (v ? ymd(new Date(v)) : "");
const shiftMonth = (ymdStr: string, delta: number) => {
  const [Y, M] = ymdStr.split("-").map(Number);
  const d = new Date(Y, (M - 1) + delta, 1);
  return { start: firstOfMonth(d), end: lastOfMonth(d) };
};

/* ===== Card UI ===== */
function Card({ title, subtitle, right, children }: { title?: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white/90 border border-[#e8ecef] shadow-[0_10px_30px_rgba(0,0,0,0.04)] overflow-hidden">
      {(title || subtitle || right) && (
        <div className="px-4 pt-4 pb-3 border-b border-[#eef1f4] bg-white/60 flex items-center justify-between">
          <div>
            {subtitle ? <div className="text-sm text-zinc-500">{subtitle}</div> : null}
            {title ? <div className="text-xl font-semibold">{title}</div> : null}
          </div>
          {right ? <div className="flex items-center gap-2">{right}</div> : null}
        </div>
      )}
      <div className="px-4 pb-4 pt-4">{children}</div>
    </section>
  );
}

/* ===== COMPONENTE PRINCIPALE ===== */
export default function AdminBackofficePage() {
  const [gate, setGate] = useState<"loading" | "no-user" | "no-role" | "ok" | "error">("loading");
  const [gateMsg, setGateMsg] = useState("");
  const [meId, setMeId] = useState<string | null>(null);

  // Identità (badge in alto)
  const [identity, setIdentity] = useState<IdentityRow | null>(null);

  // Lista utenti (tendina)
  const [users, setUsers] = useState<LabelRow[]>([]);
  const [clientQuery, setClientQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  // Ciclo
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [cycleLoading, setCycleLoading] = useState(false);
  const [cycleSaving, setCycleSaving] = useState(false);

  // Goals
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(false);
  const [goalsSavingId, setGoalsSavingId] = useState<string | number | null>(null);

  /* ===== GATE: staff ===== */
  useEffect(() => {
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) { setGate("no-user"); return; }
        setMeId(u.user.id);

        const { data: staffRow, error } = await supabase
          .from("staff")
          .select("user_id, role")
          .eq("user_id", u.user.id)
          .maybeSingle();

        if (error) { setGate("error"); setGateMsg(error.message); return; }
        if (!staffRow) { setGate("no-role"); return; }

        setGate("ok");
      } catch (e: any) {
        setGate("error"); setGateMsg(String(e?.message || e));
      }
    })();
  }, []);

  /* ===== Badge identità (mostra chi sei e ruolo) ===== */
  useEffect(() => {
    if (gate !== "ok") return;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("v_user_identity")
        .select("auth_id,email,profile_name,mentoring_id,is_staff,role")
        .eq("auth_id", u.user.id)
        .maybeSingle();
      setIdentity((data as any) || null);
    })();
  }, [gate]);

  /* ===== Carica lista utenti TUTTI (label chiara, include Tekkin & Gasparito) ===== */
  useEffect(() => {
    if (gate !== "ok") return;
    (async () => {
      const { data, error } = await supabase
        .from("v_user_label")
        .select("user_id,display_name,is_mentoring,is_staff")
        .order("display_name", { ascending: true });

      if (!error && data) {
        setUsers(data as any);
        // auto-seleziona il primo o l'utente loggato se presente
        const me = data.find(d => d.user_id === meId);
        setSelectedUser((me?.user_id) || data[0]?.user_id || null);
      }
    })();
  }, [gate, meId]);

  /* ===== Carica ciclo del cliente selezionato ===== */
  useEffect(() => {
    if (!selectedUser) return;
    setCycleLoading(true);
    (async () => {
      const { data } = await supabase
        .from("mentoring_cycles")
        .select("*")
        .eq("user_id", selectedUser)
        .order("month_start", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setCycle({
          id: data.id,
          user_id: data.user_id,
          month_start: asYMD(data.month_start) || firstOfMonth(),
          month_end: asYMD(data.month_end) || lastOfMonth(),
          paid: !!data.paid,
          notes: data.notes ?? "",
        });
      } else {
        setCycle({
          month_start: firstOfMonth(),
          month_end: lastOfMonth(),
          paid: false,
          notes: "",
        });
      }
      setCycleLoading(false);
    })();
  }, [selectedUser]);

  /* ===== Goals ===== */
  useEffect(() => {
    if (!selectedUser) return;
    setGoalsLoading(true);
    (async () => {
      const { data } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", selectedUser)
        .order("created_at");
      setGoals((data as any) || []);
      setGoalsLoading(false);
    })();
  }, [selectedUser]);

  /* ===== Filtri ===== */
  const filteredUsers = useMemo(() => {
    const q = clientQuery.toLowerCase().trim();
    return users.filter((u) =>
      ((u.display_name || "") + " " + (u.user_id || "")).toLowerCase().includes(q)
    );
  }, [users, clientQuery]);

  const selectedLabel = useMemo(() => {
    const u = users.find((x) => x.user_id === selectedUser);
    return u?.display_name || selectedUser?.slice(0, 8) || "";
  }, [users, selectedUser]);

  /* ===== Salva ciclo ===== */
  const saveCycle = async () => {
    if (!selectedUser || !cycle) return;
    setCycleSaving(true);
    const payload = {
      user_id: selectedUser,
      month_start: cycle.month_start,
      month_end: cycle.month_end || null,
      paid: !!cycle.paid,
      notes: cycle.notes || null,
    };
    const req = cycle.id
      ? supabase.from("mentoring_cycles").update(payload).eq("id", cycle.id!).select().single()
      : supabase.from("mentoring_cycles").insert(payload).select().single();

    const { data, error } = await req;
    setCycleSaving(false);
    if (error) { alert("Errore salvataggio ciclo: " + error.message); return; }

    setCycle({
      id: data!.id,
      user_id: data!.user_id,
      month_start: asYMD(data!.month_start),
      month_end: asYMD(data!.month_end),
      paid: !!data!.paid,
      notes: data!.notes ?? "",
    });
  };

  /* ===== Goals CRUD ===== */
  const addGoal = () => setGoals((prev) => [...prev, { label: "Nuovo obiettivo", progress: 0, done: false }]);

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
    if (error) { alert("Errore salvataggio obiettivo: " + error.message); return; }
    setGoals((prev) => { const cp = [...prev]; cp[i] = data as any; return cp; });
  };

  const deleteGoal = async (i: number) => {
    const row = goals[i];
    if (row.id) {
      const { error } = await supabase.from("goals").delete().eq("id", row.id);
      if (error) { alert("Errore eliminazione obiettivo: " + error.message); return; }
    }
    setGoals((prev) => prev.filter((_, idx) => idx !== i));
  };

  /* ===== Gate UI ===== */
  if (gate === "loading") return <GateBox text="Caricamento…" />;
  if (gate === "no-user") return <GateBox text="Non sei loggato. Vai su /mentoring-pro/login." />;
  if (gate === "no-role") return <GateBox text="Accesso negato (aggiungi il tuo user_id in public.staff)." />;
  if (gate === "error") return <GateBox text={`Errore: ${gateMsg}`} />;

  /* ===== UI ===== */
  return (
    <main className="min-h-screen w-full bg-[radial-gradient(circle_at_15%_10%,#ffffff_0%,#f3f7fb_45%,#eaf1f6_100%)] text-zinc-900">
      {/* Header */}
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-3xl font-bold">Mentoring Backoffice</h1>
          <div className="ml-auto text-sm text-zinc-500">Logged: {meId?.slice(0, 8)}…</div>
        </div>
      </div>

      {/* Badge identità */}
      {identity && (
        <div className="mx-auto max-w-7xl px-4 -mt-4 pb-2 text-sm text-zinc-600">
          <div className="inline-flex items-center gap-2 rounded-lg border border-[#e8ecef] bg-white px-3 py-1.5">
            <span><b>{identity.profile_name || identity.email}</b></span>
            <span className={`text-xs rounded px-2 py-0.5 ${identity.is_staff ? 'bg-black text-white' : 'bg-zinc-100'}`}>
              {identity.role || (identity.is_staff ? 'STAFF' : 'USER')}
            </span>
            <span className="text-xs">auth_id: {identity.auth_id.slice(0,8)}…</span>
            {identity.mentoring_id
              ? <span className="text-xs">mentoring_id: {identity.mentoring_id.slice(0,8)}…</span>
              : <span className="text-xs">no mentoring</span>}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 pb-10 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* SX: Cliente */}
        <div className="lg:col-span-4 space-y-4">
          <Card title="Cliente" subtitle="Seleziona l'artista">
            <div className="relative mb-2">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-zinc-500" />
              <input
                value={clientQuery}
                onChange={(e) => setClientQuery(e.target.value)}
                placeholder="Cerca per nome o ID…"
                className="w-full rounded-lg border border-[#e8ecef] bg-white px-8 py-2"
              />
            </div>
            <select
              value={selectedUser ?? ""}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full rounded-lg border border-[#e8ecef] bg-white px-3 py-2"
            >
              {filteredUsers.map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  {u.display_name} {u.is_mentoring ? "" : "(no mentoring)"} {u.is_staff ? "· admin" : ""}
                </option>
              ))}
            </select>
            <div className="mt-2 text-xs text-zinc-500">
              Selezionato: <b>{selectedLabel}</b>
            </div>
          </Card>

          {/* Goals */}
          <Card title="Obiettivi" subtitle="Gestione rapida">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-zinc-600">Crea e aggiorna gli obiettivi del mese</div>
              <button
                onClick={addGoal}
                className="rounded-lg border border-[#e8ecef] bg-white px-3 py-2 text-sm hover:bg-zinc-50 inline-flex items-center gap-2"
              >
                <Plus className="h-4 w-4" /> Nuovo
              </button>
            </div>

            {goalsLoading ? (
              <div className="text-sm text-zinc-500">Carico…</div>
            ) : goals.length === 0 ? (
              <div className="text-sm text-zinc-500">Nessun obiettivo.</div>
            ) : (
              <div className="space-y-3">
                {goals.map((g, i) => (
                  <div key={g.id ?? i} className="rounded-xl border border-[#eef1f4] bg-white p-3 grid md:grid-cols-7 gap-2 items-center">
                    <input
                      className="md:col-span-3 rounded-lg border border-[#e8ecef] bg-white px-3 py-2 text-sm"
                      value={g.label || ""}
                      onChange={(e) => setGoals((prev) => { const cp = [...prev]; cp[i] = { ...cp[i], label: e.target.value }; return cp; })}
                    />
                    <input
                      type="date"
                      className="rounded-lg border border-[#e8ecef] bg-white px-3 py-2 text-sm"
                      value={asYMD(g.due_date) || ""}
                      onChange={(e) => setGoals((prev) => { const cp = [...prev]; cp[i] = { ...cp[i], due_date: e.target.value || null }; return cp; })}
                    />
                    <input
                      type="number" min={0} max={100}
                      className="rounded-lg border border-[#e8ecef] bg-white px-3 py-2 text-sm"
                      value={g.progress ?? 0}
                      onChange={(e) => setGoals((prev) => { const cp = [...prev]; cp[i] = { ...cp[i], progress: Number(e.target.value) || 0 }; return cp; })}
                    />
                    <label className="inline-flex items-center justify-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={!!g.done}
                        onChange={(e) => setGoals((prev) => { const cp = [...prev]; cp[i] = { ...cp[i], done: e.target.checked }; return cp; })}
                      />
                      <span>Done</span>
                    </label>

                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => saveGoal(i)}
                        className="rounded-lg border border-[#e8ecef] bg-white px-3 py-2 text-sm hover:bg-zinc-50 inline-flex items-center gap-2"
                        disabled={goalsSavingId === (g.id ?? i)}
                        title="Salva"
                      >
                        {goalsSavingId === (g.id ?? i) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Salva
                      </button>
                      <button
                        onClick={() => deleteGoal(i)}
                        className="rounded-lg border border-[#e8ecef] bg-white px-3 py-2 text-sm hover:bg-zinc-50"
                        title="Elimina"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* DX: Ciclo */}
        <div className="lg:col-span-8 space-y-4">
          <Card
            title="Ciclo mensile"
            subtitle="Definisci il periodo e lo stato del pagamento"
            right={
              <>
                <button
                  onClick={() => setCycle((c) => c ? { ...c, ...shiftMonth(c.month_start, -1) } : c)}
                  className="rounded-lg border border-[#e8ecef] bg-white px-2 py-2 hover:bg-zinc-50"
                  title="Mese precedente"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setCycle((c) => c ? { ...c, month_start: firstOfMonth(), month_end: lastOfMonth() } : c)}
                  className="rounded-lg border border-[#e8ecef] bg-white px-2 py-2 hover:bg-zinc-50"
                  title="Mese corrente"
                >
                  <CalendarCheck2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setCycle((c) => c ? { ...c, ...shiftMonth(c.month_start, +1) } : c)}
                  className="rounded-lg border border-[#e8ecef] bg-white px-2 py-2 hover:bg-zinc-50"
                  title="Mese successivo"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>

                <button
                  onClick={saveCycle}
                  disabled={cycleSaving || cycleLoading}
                  className="ml-2 rounded-lg bg-black text-white px-3 py-2 text-sm hover:opacity-90 inline-flex items-center gap-2"
                >
                  {cycleSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {cycleSaving ? "Salvo..." : "Salva"}
                </button>
              </>
            }
          >
            {cycleLoading ? (
              <div className="text-sm text-zinc-600">Carico…</div>
            ) : (
              <>
                <div className="grid md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-zinc-500">Data inizio mese</label>
                    <input
                      type="date"
                      className="w-full rounded-lg border border-[#e8ecef] bg-white px-3 py-2"
                      value={cycle?.month_start || ""}
                      onChange={(e) => setCycle((c) => (c ? { ...c, month_start: e.target.value } : c))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500">Data fine mese</label>
                    <input
                      type="date"
                      className="w-full rounded-lg border border-[#e8ecef] bg-white px-3 py-2"
                      value={cycle?.month_end || ""}
                      onChange={(e) => setCycle((c) => (c ? { ...c, month_end: e.target.value || null } : c))}
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={!!cycle?.paid}
                        onChange={(e) => setCycle((c) => (c ? { ...c, paid: e.target.checked } : c))}
                      />
                      <span>Pagato</span>
                    </label>
                  </div>
                </div>

                <div className="mt-3">
                  <label className="text-xs text-zinc-500">Note</label>
                  <textarea
                    className="w-full min-h-28 rounded-lg border border-[#e8ecef] bg-white px-3 py-2"
                    placeholder="Note sul mese, focus, accordi"
                    value={cycle?.notes || ""}
                    onChange={(e) => setCycle((c) => (c ? { ...c, notes: e.target.value } : c))}
                  />
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </main>
  );
}

/* ===== GateBox ===== */
function GateBox({ text }: { text: string }) {
  return (
    <main className="min-h-screen grid place-items-center bg-[radial-gradient(circle_at_15%_10%,#ffffff_0%,#f3f7fb_45%,#eaf1f6_100%)] text-zinc-800">
      <div className="rounded-2xl bg-white/90 border border-[#e8ecef] shadow-[0_10px_30px_rgba(0,0,0,0.04)] p-6 text-center">
        <div className="text-xl font-semibold mb-1">Mentoring Backoffice</div>
        <div className="text-sm text-zinc-600">{text}</div>
      </div>
    </main>
  );
}
