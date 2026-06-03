import { SKIN_LABELS, SKINS, type Skin } from "../hooks/useTheme.js";

// Light-mode accent + surface per skin, for the swatch preview dots.
const SWATCH: Record<Skin, { accent: string; surface: string; hair: string }> = {
  "reading-room": { accent: "#b4451f", surface: "#faf8f3", hair: "#e7e2d8" },
  slate: { accent: "#2563eb", surface: "#fcfcfd", hair: "#e6e8ec" },
  terminal: { accent: "#00a152", surface: "#f4f4f1", hair: "#d8d8d2" },
};

interface Props {
  skin: Skin;
  setSkin: (s: Skin) => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

export function ThemePicker({ skin, setSkin, theme, onToggleTheme }: Props) {
  return (
    <div className="px-2 py-2 space-y-1">
      <div className="flex items-center justify-between px-1 pb-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Theme</span>
        <button
          type="button"
          onClick={onToggleTheme}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-raise hover:text-ink transition"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? "☾ Dark" : "☀ Light"}
        </button>
      </div>
      {SKINS.map((s) => {
        const sw = SWATCH[s];
        const active = s === skin;
        return (
          <button
            type="button"
            key={s}
            onClick={() => setSkin(s)}
            className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition ${
              active ? "bg-accent-soft text-ink" : "text-muted hover:bg-raise hover:text-ink"
            }`}
          >
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border"
              style={{ background: sw.surface, borderColor: sw.hair }}
            >
              <span className="h-3 w-3 rounded-full" style={{ background: sw.accent }} />
            </span>
            <span className="flex-1 font-medium">{SKIN_LABELS[s]}</span>
            {active && <span className="text-accent">✓</span>}
          </button>
        );
      })}
    </div>
  );
}
