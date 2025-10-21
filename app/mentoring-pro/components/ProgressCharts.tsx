"use client";
import { Card, CardContent } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  CartesianGrid,
} from "recharts";
import { Activity, CalendarDays } from "lucide-react";

export default function ProgressCharts() {
  const completion = 75;
  const radialData = [
    { name: "progress", value: completion, fill: "#22d3ee" },
    { name: "rest", value: 100 - completion, fill: "#0b0b0b" },
  ];

  const hoursSeries = [
    { week: "W1", hours: 1.5 },
    { week: "W2", hours: 2.0 },
    { week: "W3", hours: 1.2 },
    { week: "W4", hours: 1.3 },
  ];

  return (
    <div className="grid xl:grid-cols-2 gap-6 mb-6">
      <Card className="bg-[#111] border border-[#00ffff44]">
        <CardContent className="p-5">
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
            <Activity className="h-5 w-5 text-cyan-300" /> Avanzamento
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%"
                cy="50%"
                innerRadius="60%"
                outerRadius="100%"
                barSize={18}
                data={radialData}
                startAngle={90}
                endAngle={-270}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar
                  dataKey="value"
                  background={{ fill: "#111" }}
                  cornerRadius={10}
                  fill="#22d3ee"
                />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-center text-sm mt-2 text-zinc-400">
            {completion}% completato
          </p>
        </CardContent>
      </Card>

      <Card className="bg-[#111] border border-[#00ffff44]">
        <CardContent className="p-5">
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
            <CalendarDays className="h-5 w-5 text-cyan-300" /> Ore mensili
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hoursSeries} margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="week" tick={{ fontSize: 12, fill: "#a1a1aa" }} />
                <YAxis tick={{ fontSize: 12, fill: "#a1a1aa" }} />
                <Tooltip
                  contentStyle={{
                    background: "#111",
                    border: "1px solid #00ffff55",
                    color: "#e4e4e7",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="hours"
                  stroke="#22d3ee"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
