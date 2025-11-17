"use client";
export default function CalendarSection() {
  const items = [
    { id: "1", t: "Mix finale traccia", d: "21 Ottobre" },
    { id: "2", t: "Call mensile", d: "22 Ottobre ore 18:00" },
    { id: "3", t: "Invio progetto su Trackstack", d: "25 Ottobre" },
  ];
  return (
    <div className="rounded-xl border border-[#eef1f4] bg-white p-4">
      <div className="text-sm font-semibold mb-2">Prossime attività</div>
      <ul className="space-y-2">
        {items.map(i => (
          <li key={i.id} className="rounded-lg border border-[#eef1f4] bg-white px-3 py-2 text-sm">
            <div className="font-medium">{i.t}</div>
            <div className="text-xs text-zinc-500">{i.d}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
