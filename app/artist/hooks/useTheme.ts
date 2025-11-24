import { useEffect, useState } from "react";

type Theme = "light" | "dark";
const STORAGE_KEY = "tekkin_theme";

function getPreferred(): Theme {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const initial = getPreferred();
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  const applyTheme = (value: Theme) => {
    setTheme(value);
    if (typeof window !== "undefined") {
      document.documentElement.setAttribute("data-theme", value);
      window.localStorage.setItem(STORAGE_KEY, value);
    }
  };

  const toggleTheme = () => applyTheme(theme === "dark" ? "light" : "dark");

  return { theme, setTheme: applyTheme, toggleTheme };
}
