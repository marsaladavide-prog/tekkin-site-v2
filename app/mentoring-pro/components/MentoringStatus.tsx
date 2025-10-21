import { Card, CardContent } from "@/components/ui/card";
import { Target } from "lucide-react";

export default function MentoringStatus() {
  return (
    <Card className="bg-[#111] border border-[#00ffff33] mb-6">
      <CardContent className="p-5">
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Target className="h-5 w-5 text-cyan-300" /> Stato Mentoring
        </h3>
        <ul className="text-sm text-zinc-400 space-y-1">
          <li>
            Ore lavorate: <span className="text-cyan-300">6 / 12</span>
          </li>
          <li>Obiettivo: completare 3 tracce originali</li>
          <li>Prossima call: 22 Ottobre alle 18:00</li>
          <li>
            Rinnovo: <span className="text-cyan-300">30 Ottobre</span>
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}
