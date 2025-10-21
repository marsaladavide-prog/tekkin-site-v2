"use client";
import { useMemo } from "react";

type Props = {
  size?: number;
  seed?: string | null;
  variant?: number;
  rounded?: boolean;
  className?: string;
};

// Funzione hash deterministica per generare variazioni visive
function hashToFloat(s: string, salt: string) {
  const str = s + salt;
  let hash = 0;
  for (let i = 0; i < str.length; i++)
    hash = (hash * 31 + str.charCodeAt(i)) % 1000000;
  return hash / 1000000;
}

export default function GlitchAvatar({
  size = 80,
  seed = "tekkin",
  variant = 0,
  rounded = true,
  className = "",
}: Props) {
  const safeSeed = seed || "tekkin";

  const id = useMemo(
    () => `glitch_${variant}_${safeSeed.replace(/[^a-z0-9]/gi, "")}`,
    [safeSeed, variant]
  );

  // palette Tekkin (ciano-magenta)
  const h1 = 180 + Math.floor(hashToFloat(safeSeed, "h1") * 60); // blu/ciano
  const h2 = 280 + Math.floor(hashToFloat(safeSeed, "h2") * 60); // viola/magenta
  const c1 = `hsl(${h1}, 100%, 60%)`;
  const c2 = `hsl(${h2}, 100%, 60%)`;

  // pattern glitch personalizzato
  const shapes = Array.from({ length: 6 }, (_, i) => ({
    x: hashToFloat(safeSeed, "x" + i) * 100,
    y: hashToFloat(safeSeed, "y" + i) * 100,
    w: 10 + hashToFloat(safeSeed, "w" + i) * 30,
    h: 4 + hashToFloat(safeSeed, "h" + i) * 20,
  }));

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`${rounded ? "rounded-full" : ""} ${className}`}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c1} />
          <stop offset="100%" stopColor={c2} />
        </linearGradient>

        {/* Filtro glitch animato */}
        <filter id={`${id}_glitch`}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="2"
            result="turb"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="turb"
            scale={variant * 5 + 8}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>

      {/* Background principale */}
      <rect x="0" y="0" width="100" height="100" fill={`url(#${id})`} />

      {/* Overlay pattern glitch */}
      <g filter={`url(#${id}_glitch)`}>
        {shapes.map((s, i) => (
          <rect
            key={i}
            x={s.x}
            y={s.y}
            width={s.w}
            height={s.h}
            fill={i % 2 === 0 ? c1 : c2}
            opacity="0.6"
          />
        ))}
      </g>

      {/* Overlay trasparente per effetto vetro */}
      <rect
        x="0"
        y="0"
        width="100"
        height="100"
        fill="transparent"
        stroke="#00ffff44"
        strokeWidth="0.4"
      />
    </svg>
  );
}
