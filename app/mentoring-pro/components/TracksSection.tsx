"use client";
import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Pause, Download, MessageSquare } from "lucide-react";
import WaveSurfer from "wavesurfer.js";

interface Track {
  title: string;
  artist: string;
  url: string;
}

interface Comment {
  time: number;
  text: string;
}

const TRACKS: Track[] = [
  { title: "Groove Intentions", artist: "Davide Marsala", url: "/tracks/groove.wav" },
  { title: "Floorstate", artist: "Davide Marsala", url: "/tracks/floorstate.wav" },
  { title: "Take It Off", artist: "Davide Marsala", url: "/tracks/takeitoff.wav" },
];

export default function TracksSection() {
  const waveformRefs = useRef<(HTMLDivElement | null)[]>([]);
  const wavesurferRefs = useRef<(WaveSurfer | null)[]>([]);
  const [activeTrack, setActiveTrack] = useState<number | null>(null);
  const [comments, setComments] = useState<Record<number, Comment[]>>({});
  const [showBox, setShowBox] = useState<{ i: number; time: number } | null>(null);
  const [newComment, setNewComment] = useState("");

  // === CREA WAVEFORM PER OGNI TRACCIA ===
  useEffect(() => {
    TRACKS.forEach((track, i) => {
      if (!waveformRefs.current[i]) return;

      const ws = WaveSurfer.create({
        container: waveformRefs.current[i]!,
        waveColor: "rgba(0,255,255,0.3)",
        progressColor: "rgba(0,255,255,0.8)",
        cursorColor: "#00ffff",
        height: 60,
        barWidth: 2,
        barGap: 2,
        responsive: true,
      });

      ws.load(track.url);
      wavesurferRefs.current[i] = ws;

      ws.on("click", (e) => {
        const duration = ws.getDuration();
        const pixelRatio = ws.drawer?.width / duration;
        const time = e.offsetX / pixelRatio;
        setShowBox({ i, time });
      });

      return () => {
        ws.destroy();
      };
    });
  }, []);

  const togglePlay = (i: number) => {
    if (activeTrack !== null && activeTrack !== i) {
      wavesurferRefs.current[activeTrack]?.pause();
    }
    const ws = wavesurferRefs.current[i];
    if (!ws) return;
    if (ws.isPlaying()) {
      ws.pause();
      setActiveTrack(null);
    } else {
      ws.play();
      setActiveTrack(i);
    }
  };

  const addComment = (i: number) => {
    if (!newComment.trim() || !showBox) return;
    const updated = [
      ...(comments[i] || []),
      { time: parseFloat(showBox.time.toFixed(1)), text: newComment },
    ];
    setComments({ ...comments, [i]: updated });
    setNewComment("");
    setShowBox(null);
  };

  return (
    <Card className="relative z-10 bg-[#111] border border-[#00ffff33] mb-6">
      <CardContent className="p-5">
        <h3 className="text-lg font-semibold gradText mb-4">Tracce in lavorazione</h3>

        <div className="flex flex-col gap-6">
          {TRACKS.map((t, i) => (
            <div
              key={i}
              className="bg-[#0b0b0b] border border-[#00ffff22] rounded-xl overflow-hidden hover:bg-[#0f0f0f] transition relative"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-3">
                <div>
                  <p className="font-semibold text-cyan-300">{t.title}</p>
                  <p className="text-sm text-zinc-400">{t.artist}</p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => togglePlay(i)}
                    className="p-2 rounded-md bg-[#00ffff22] hover:bg-[#00ffff44] text-cyan-300"
                  >
                    {activeTrack === i ? <Pause size={18} /> : <Play size={18} />}
                  </button>
                  <button
                    onClick={() =>
                      alert("💬 Clicca sulla waveform per aggiungere un commento")
                    }
                    className="p-2 rounded-md bg-[#222] hover:bg-[#333]"
                  >
                    <MessageSquare size={18} className="text-zinc-400" />
                  </button>
                  <a
                    href={t.url}
                    download
                    className="p-2 rounded-md bg-[#222] hover:bg-[#333]"
                  >
                    <Download size={18} className="text-zinc-400" />
                  </a>
                </div>
              </div>

              {/* Waveform */}
              <div className="relative px-3 pb-4">
                <div ref={(el) => (waveformRefs.current[i] = el)} />

                {/* Comment markers */}
                {comments[i]?.map((c, idx) => (
                  <div
                    key={idx}
                    className="absolute top-0 h-[60px] w-[2px] bg-cyan-400 cursor-pointer opacity-70 hover:opacity-100"
                    style={{
                      left: `${
                        (c.time / (wavesurferRefs.current[i]?.getDuration() || 1)) * 100
                      }%`,
                    }}
                    title={`${c.time}s - ${c.text}`}
                  />
                ))}

                {/* Floating comment box */}
                {showBox?.i === i && (
                  <div
                    className="absolute bg-[#0b0b0b] border border-[#00ffff66] rounded-lg p-3 shadow-lg w-64 text-sm"
                    style={{
                      top: 0,
                      left: `${
                        (showBox.time /
                          (wavesurferRefs.current[i]?.getDuration() || 1)) *
                        100
                      }%`,
                      transform: "translate(-50%, -110%)",
                    }}
                  >
                    <p className="text-cyan-300 text-xs mb-1">
                      Commento @ {showBox.time.toFixed(1)}s
                    </p>
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="w-full bg-[#111] border border-[#00ffff33] rounded-md p-2 text-sm text-zinc-200"
                      placeholder="Scrivi un commento..."
                    />
                    <div className="flex justify-end gap-2 mt-2">
                      <button
                        onClick={() => setShowBox(null)}
                        className="text-zinc-400 text-xs hover:text-zinc-200"
                      >
                        Annulla
                      </button>
                      <button
                        onClick={() => addComment(i)}
                        className="text-cyan-300 text-xs hover:text-cyan-200"
                      >
                        Aggiungi
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
