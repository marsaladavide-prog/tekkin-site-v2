"use client";
export default function ProgressCharts() {
  const pct = 75;
  return (
    <div className="rounded-xl border border-[#eef1f4] bg-white p-4">
      <div className="text-sm text-zinc-500">Avanzamento</div>
      <div className="mt-2 w-full h-2 rounded-full bg-zinc-100 overflow-hidden">
        <div className="h-full bg-cyan-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 text-xs text-zinc-600">{pct}% completato</div>
    </div>
  );
}