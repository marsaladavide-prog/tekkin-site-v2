"use client";

import { useEffect, useRef, useState } from "react";
import { useTekkinPlayer } from "@/lib/player/useTekkinPlayer";
import { audioManager } from "@/lib/analyzer/audioManager";

export function useRealtimeStereo(enabled: boolean) {
  const audioRef = useTekkinPlayer((s) => s.audioRef);
  const isPlaying = useTekkinPlayer((s) => s.isPlaying);
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const rafRef = useRef<number | null>(null);

  // 1. Attacca il manager all'audio element
  useEffect(() => {
    if (!enabled || !audioRef?.current) return;

    const audioEl = audioRef.current;
    
    // Inizializza il singleton audio se non è già attivo
    audioManager.attach(audioEl);
    audioManager.resume();

  }, [enabled, audioRef]);

  // 2. Loop di analisi
  useEffect(() => {
    if (!enabled || !isPlaying) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    // Assicuriamoci che il contesto sia attivo quando inizia la riproduzione
    audioManager.resume();

    const loop = () => {
      const analyserL = audioManager.analyserL;
      const analyserR = audioManager.analyserR;

      if (!analyserL || !analyserR) {
        // Riprova al prossimo frame se non ancora pronti
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const bufferLength = analyserL.frequencyBinCount; 
      const dataL = new Float32Array(bufferLength);
      const dataR = new Float32Array(bufferLength);

      analyserL.getFloatTimeDomainData(dataL);
      analyserR.getFloatTimeDomainData(dataR);

      // Downsample per performance
      const pts: { x: number; y: number }[] = [];
      const step = 2; 
      
      for (let i = 0; i < bufferLength; i += step) {
        const l = dataL[i];
        const r = dataR[i];
        
        // Mid / Side encoding per Goniometro
        // Mid = L + R
        // Side = L - R
        // X = Side, Y = Mid
        
        const mid = (l + r) * 0.5;
        const side = (l - r) * 0.5;
        
        pts.push({ x: side, y: mid });
      }

      setPoints(pts);
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

  return points;
}
