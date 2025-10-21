import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";

export default function CalendarSection() {
  return (
    <Card className="relative z-10 bg-[#111] border border-[#00ffff33] mb-6">
      <CardContent className="p-5">
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <CalendarDays className="h-5 w-5 text-cyan-300" /> Prossime attività
        </h3>
        <ul className="text-sm text-zinc-400 space-y-1">
          <li>✅ Mix finale traccia “Groove Intentions” — 21 Ottobre</li>
          <li>📞 Call mensile — 22 Ottobre ore 18:00</li>
          <li>📤 Invia progetto “0079” su Trackstack — 25 Ottobre</li>
        </ul>
      </CardContent>
    </Card>
  );
}
