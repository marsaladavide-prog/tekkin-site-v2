"use client";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const brand = {
  bg: "bg-[#0b0b0b]",
  text: "text-zinc-200",
};

export default function Splash({ onDone }: { onDone: () => void }) {
  const [pixels] = useState(
    Array.from({ length: 64 }, (_, i) => ({
      id: i,
      delay: Math.random() * 1.1,
      x: (Math.random() - 0.5) * 280,
      y: (Math.random() - 0.5) * 280,
    }))
  );

  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      className={`${brand.bg} ${brand.text} fixed inset-0 grid place-items-center overflow-hidden`}
    >
      {/* --- Glitch scanline background --- */}
      <div className="absolute inset-0 pointer-events-none animate-scanlines bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.05),rgba(255,255,255,0.05)_1px,transparent_2px,transparent_4px)]"></div>

      <div className="relative w-[320px] h-[320px] z-10">
        <div className="absolute inset-0 grid grid-cols-8 grid-rows-8 gap-[2px]">
          {pixels.map((p) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 1, scale: 1, x: 0, y: 0 }}
              animate={{
                opacity: [1, 0.4, 1, 0],
                scale: [1, 1.05, 0.95, 1, 0.9],
                x: [0, 0, 0, p.x],
                y: [0, 0, 0, p.y],
              }}
              transition={{
                duration: 2.8,
                delay: p.delay,
                ease: "easeInOut",
              }}
              className="bg-[#1f1f1f]"
            />
          ))}
        </div>

        <motion.h1
          initial={{ opacity: 0, letterSpacing: 12 }}
          animate={{
            opacity: 1,
            letterSpacing: 2,
            x: [0, -1, 1, -1, 0],
            y: [0, 1, -1, 0, 0],
          }}
          transition={{
            duration: 1.2,
            ease: "easeOut",
            repeat: Infinity,
            repeatDelay: 0.2,
          }}
          className="absolute inset-0 grid place-items-center text-4xl tracking-[.2em] font-semibold select-none"
        >
          TEKKIN
        </motion.h1>

        <motion.div
          initial={{ y: -160, opacity: 0 }}
          animate={{ y: 160, opacity: [0, 0.35, 0] }}
          transition={{ duration: 1.2, ease: "easeInOut", delay: 0.4 }}
          className="absolute left-0 right-0 h-[2px] bg-[#43FFD2]/60"
        />
      </div>

      {/* --- Loading section con barra --- */}
      <div className="absolute bottom-12 flex flex-col items-center gap-2 z-10">
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.8 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="text-xs tracking-widest uppercase text-zinc-500"
        >
          loading
        </motion.span>

        <motion.div
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 3, ease: "easeInOut" }}
          className="h-[2px] bg-[#43FFD2] rounded-full w-full max-w-[180px]"
        />
      </div>

      {/* --- Animazione scanline CSS inline --- */}
      <style jsx>{`
        @keyframes scanlines {
          0% {
            background-position: 0 0;
          }
          100% {
            background-position: 0 4px;
          }
        }
        .animate-scanlines {
          animation: scanlines 0.15s linear infinite;
        }
      `}</style>
    </div>
  );
}
