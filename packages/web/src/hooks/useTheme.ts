import { useEffect, useState } from "react";

export type Skin = "reading-room" | "slate" | "terminal";
export const SKINS: Skin[] = ["reading-room", "slate", "terminal"];
export const SKIN_LABELS: Record<Skin, string> = {
  "reading-room": "Reading Room",
  slate: "Slate",
  terminal: "Terminal",
};

export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("pipeit-theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  const [skin, setSkin] = useState<Skin>(() => {
    const saved = localStorage.getItem("pipeit-skin");
    return SKINS.includes(saved as Skin) ? (saved as Skin) : "reading-room";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("pipeit-theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.skin = skin;
    localStorage.setItem("pipeit-skin", skin);
  }, [skin]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return { theme, toggle, skin, setSkin };
}
