"use client";

import { useCallback, useEffect, useMemo, useRef, type MouseEvent, type TouchEvent } from "react";
import { Pause, Play } from "lucide-react";

import type { WaveformBands } from "@/types/analyzer";

type WaveformPreviewUnifiedProps = {
  peaks?: number[] | null;
  bands?: WaveformBands | null;
  duration?: number | null;
  progressRatio: number;
  isPlaying: boolean;
  timeLabel: string;
  onTogglePlay: () => void;
  onSeekRatio: (ratio: number) => void;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const clampByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
const mixRgb = (a: [number, number, number], b: [number, number, number], t: number) => {
  const ratio = clamp01(t);
  return [
    a[0] * (1 - ratio) + b[0] * ratio,
    a[1] * (1 - ratio) + b[1] * ratio,
    a[2] * (1 - ratio) + b[2] * ratio,
  ] as [number, number, number];
};

const formatDurationLabel = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

type WaveformCanvasProps = {
  peaks: number[];
  progressRatio: number;
  height?: number;
  bands?: WaveformBands | null;
};

function WaveformCanvas({ peaks, progressRatio, height = 70, bands }: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    const cssWidth = Math.max(1, parent?.clientWidth ?? canvas.getBoundingClientRect().width ?? 1);
    const cssHeight = Math.max(1, height);

    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    if (cssWidth <= 0 || cssHeight <= 0) return;

    const dpr = typeof window !== "undefined" ? Math.max(1, window.devicePixelRatio || 1) : 1;
    const deviceWidth = Math.max(1, Math.round(cssWidth * dpr));
    const deviceHeight = Math.max(1, Math.round(cssHeight * dpr));

    canvas.width = deviceWidth;
    canvas.height = deviceHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, deviceWidth, deviceHeight);

    if (!peaks.length) return;

    const widthSteps = Math.max(1, Math.round(cssWidth));
    const progressRatioClamped = clamp01(progressRatio);
    const progressLimit = Math.max(0, Math.min(widthSteps, Math.round(widthSteps * progressRatioClamped)));
    const cssStep = cssWidth / widthSteps;
    const halfHeight = deviceHeight / 2;

    type ColumnData = {
      amplitude: number;
      baseColor: string;
      progressColor: string;
    };

    const hasBandData =
      bands &&
      Array.isArray(bands.sub) &&
      bands.sub.length > 0 &&
      Array.isArray(bands.mid) &&
      bands.mid.length > 0 &&
      Array.isArray(bands.high) &&
      bands.high.length > 0;

    const sampleCount = peaks.length;
    const mapBandValue = (band: number[] | undefined, sampleIndex: number) => {
      if (!band || !band.length || sampleCount <= 0) return 0;
      const ratio = sampleCount > 1 ? sampleIndex / (sampleCount - 1) : 0;
      const idx = Math.min(band.length - 1, Math.floor(ratio * (band.length - 1)));
      return clamp01(band[idx] ?? 0);
    };

    const buildSpectrumColor = (
      energies: { sub: number; mid: number; high: number },
      opacity: number,
      darken: boolean
    ) => {
      const totalSubHigh = Math.max(1e-6, energies.sub + energies.high);
      const highWeight = energies.high / totalSubHigh;
      const baseMix = mixRgb([239, 68, 68], [250, 204, 21], highWeight);
      const midInfluence = clamp01(energies.mid) * 0.65;
      const midMix = mixRgb(baseMix, [168, 85, 247], midInfluence);
      const brightness = darken ? 0.55 : 1;
      const finalRgb: [number, number, number] = [
        clampByte(midMix[0] * brightness),
        clampByte(midMix[1] * brightness),
        clampByte(midMix[2] * brightness),
      ];
      return `rgba(${finalRgb[0]}, ${finalRgb[1]}, ${finalRgb[2]}, ${opacity})`;
    };

    const columns: ColumnData[] = [];
    for (let i = 0; i < widthSteps; i += 1) {
      const sampleIndex =
        sampleCount > 1 ? Math.min(sampleCount - 1, Math.floor((i / widthSteps) * sampleCount)) : 0;
      const peakValue = peaks[sampleIndex] ?? 0;
      const amplitude = Math.min(1, Math.max(0, Math.abs(peakValue)));

      let baseColor = "rgba(107, 114, 128, 0.35)";
      let progressColor = "#22d3ee";
      if (hasBandData && bands) {
        const energies = {
          sub: mapBandValue(bands.sub, sampleIndex),
          mid: mapBandValue(bands.mid, sampleIndex),
          high: mapBandValue(bands.high, sampleIndex),
        };
        baseColor = buildSpectrumColor(energies, 0.35, true);
        progressColor = buildSpectrumColor(energies, 1, false);
      }

      columns.push({ amplitude, baseColor, progressColor });
    }

    const drawRange = (limit: number, useProgressColors: boolean) => {
      const safeLimit = Math.min(limit, columns.length);
      ctx.lineWidth = Math.max(1, dpr);
      ctx.lineCap = "round";

      for (let i = 0; i < safeLimit; i += 1) {
        const column = columns[i];
        const lineHeight = Math.max(1, column.amplitude * deviceHeight);
        const startY = halfHeight - lineHeight / 2;
        const endY = halfHeight + lineHeight / 2;
        const cssX = (i + 0.5) * cssStep;
        const drawX = cssX * dpr;
        ctx.beginPath();
        ctx.strokeStyle = useProgressColors ? column.progressColor : column.baseColor;
        ctx.moveTo(drawX, startY);
        ctx.lineTo(drawX, endY);
        ctx.stroke();
      }
    };

    drawRange(widthSteps, false);
    if (progressLimit > 0) {
      drawRange(progressLimit, true);
    }
  }, [bands, height, peaks, progressRatio]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frameId: number | null = null;

    const scheduleDraw = () => {
      if (frameId != null) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(drawWaveform);
    };

    scheduleDraw();

    const cleanup: (() => void)[] = [];

    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver(scheduleDraw);
      observer.observe(canvas.parentElement ?? canvas);
      cleanup.push(() => observer.disconnect());
    } else if (typeof window !== "undefined") {
      const handleResize = () => scheduleDraw();
      window.addEventListener("resize", handleResize);
      cleanup.push(() => window.removeEventListener("resize", handleResize));
    }

    return () => {
      if (frameId != null) cancelAnimationFrame(frameId);
      cleanup.forEach((fn) => fn());
    };
  }, [drawWaveform]);

  return <canvas ref={canvasRef} className="h-full w-full block" style={{ height }} aria-hidden />;
}

export default function WaveformPreviewUnified({
  peaks,
  bands,
  duration,
  progressRatio,
  isPlaying,
  timeLabel,
  onTogglePlay,
  onSeekRatio,
}: WaveformPreviewUnifiedProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hasPeaks = Array.isArray(peaks) && peaks.length > 0;
  const normalizedProgress = useMemo(() => clamp01(progressRatio), [progressRatio]);

  const seekFromPointer = useCallback(
    (clientX: number | null) => {
      const container = containerRef.current;
      if (!container || clientX === null) return;
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0) return;
      const x = clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, x / rect.width));
      onSeekRatio(ratio);
    },
    [onSeekRatio]
  );

  const handleMouseDown = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      seekFromPointer(event.clientX);
    },
    [seekFromPointer]
  );

  const handleTouchStart = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      seekFromPointer(event.touches[0]?.clientX ?? null);
    },
    [seekFromPointer]
  );

  const durationLabel = useMemo(() => {
    if (duration == null) return null;
    return formatDurationLabel(duration);
  }, [duration]);

  const playButtonLabel = isPlaying
    ? `Pause preview${durationLabel ? ` (${durationLabel})` : ""}`
    : `Play preview${durationLabel ? ` (${durationLabel})` : ""}`;

  return (
    <div className="p-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onTogglePlay}
          className="h-12 w-12 shrink-0 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 flex items-center justify-center"
          aria-label={playButtonLabel}
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-[1px]" />}
        </button>

        <div
          ref={containerRef}
          className="relative flex-1 min-w-0 overflow-hidden rounded-[18px] bg-[#0a0c12] cursor-pointer"
          style={{ height: 70 }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          title="Clicca per spostarti nella traccia"
        >
          {hasPeaks ? (
            <WaveformCanvas
              peaks={peaks ?? []}
              progressRatio={normalizedProgress}
              height={70}
              bands={bands ?? null}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[11px] text-white/40">
              waveform non pronta
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-b from-transparent to-[#0a0c12]" />
        </div>

        <div className="w-24 shrink-0 text-right text-[11px] text-white/70">{timeLabel}</div>
      </div>

      <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-white/55">Stream preview</p>
    </div>
  );
}
