"use client";

import { useEffect, useRef, useState } from "react";
import { useTekkinPlayer } from "@/lib/player/useTekkinPlayer";
import { audioManager } from "@/lib/analyzer/audioManager";

export function useRealtimeSpectrum(enabled: boolean) {
  const audioRef = useTekkinPlayer((s) => s.audioRef);
  const isPlaying = useTekkinPlayer((s) => s.isPlaying);
  const [frequencyData, setFrequencyData] = useState<Float32Array | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !audioRef?.current) return;
    audioManager.attach(audioRef.current);
    audioManager.resume();
  }, [enabled, audioRef]);

  useEffect(() => {
    if (!enabled || !isPlaying) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    // Assicuriamoci che il contesto sia attivo
    audioManager.resume();

    const loop = () => {
      const analyser = audioManager.analyserSpectrum;
      if (!analyser) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const bufferLength = analyser.frequencyBinCount;
      const data = new Float32Array(bufferLength);
      analyser.getFloatFrequencyData(data);

      setFrequencyData(data);
      rafRef.current = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [enabled, isPlaying]);

  return frequencyData;
}
