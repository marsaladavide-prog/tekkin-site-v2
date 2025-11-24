import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        tekkin: {
          bg: "#0a0a0a",
          panel: "#0f0f0f",
          border: "#1e1e1e",
          primary: "#06b6d4",
          muted: "#b3b3b3",
          success: "#10b981",
          warning: "#f59e0b",
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
};

export default config;
