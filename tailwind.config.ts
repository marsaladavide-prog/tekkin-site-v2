import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        tekkin: {
          bg: "var(--bg)",
          panel: "var(--panel)",
          panelSoft: "var(--panel-soft)",
          border: "var(--border)",
          fg: "var(--text)",
          muted: "var(--muted)",
          accent: "var(--accent)",
          accentSoft: "var(--accent-soft)",
          accentGlow: "var(--accent-glow)",
          grid: "var(--grid)",
          primary: "var(--accent)",
          warning: "var(--accent)",
        },
      },
      boxShadow: {
        "soft-xl": "var(--shadow-soft)",
        "panel-xl": "0 25px 45px rgba(0, 0, 0, 0.55)",
      },
      borderRadius: {
        "soft-xl": "1.25rem",
        "soft-lg": "1rem",
        "pill": "999px",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
};

export default config;
