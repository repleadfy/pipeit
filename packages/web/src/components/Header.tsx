import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Skin } from "../hooks/useTheme.js";
import { useAuth } from "../lib/auth.js";
import { ThemePicker } from "./ThemePicker.js";

const iconProps = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function UploadIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 15V4M12 4 8 8M12 4l4 4" />
      <path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

interface HeaderProps {
  onToggleTOC: () => void;
  onToggleSearch: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  skin: Skin;
  setSkin: (s: Skin) => void;
  docTitle?: string;
}

export function Header({ onToggleTOC, onToggleSearch, theme, onToggleTheme, skin, setSkin, docTitle }: HeaderProps) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [menuOpen]);

  const ghost =
    "inline-flex items-center justify-center gap-1.5 min-h-9 px-2.5 rounded-lg text-sm font-medium text-muted hover:text-ink hover:bg-raise transition";

  return (
    <header className="sticky top-0 z-40 flex items-center gap-3 px-4 py-2 bg-app/80 backdrop-blur border-b border-hair">
      <button type="button" onClick={onToggleTOC} className={`lg:hidden ${ghost}`} aria-label="Table of contents">
        &#9776;
      </button>
      <Link to="/d/latest" className="font-heading font-bold tracking-tight text-ink shrink-0" aria-label="pipeit home">
        pipeit
      </Link>
      {docTitle && (
        <span className="min-w-0 truncate text-sm text-muted">
          <span className="opacity-50">/ </span>
          <span className="text-ink/90">{docTitle}</span>
        </span>
      )}
      <div className="flex-1" />
      <div className="flex items-center gap-1">
        {user && (
          <Link to="/upload" className={`hidden sm:inline-flex ${ghost}`} aria-label="Upload a document">
            <UploadIcon />
            Upload
          </Link>
        )}
        <button type="button" onClick={onToggleSearch} className={ghost} aria-label="Search your docs">
          <SearchIcon />
          <kbd className="hidden sm:inline text-[11px] text-muted bg-surface px-1.5 py-0.5 rounded border border-hair">
            &#x2318;K
          </kbd>
        </button>
        {user && (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-label="Account menu"
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs font-bold text-on-accent overflow-hidden"
            >
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full" />
              ) : (
                user.name[0].toUpperCase()
              )}
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-60 bg-surface border border-hair rounded-xl shadow-xl py-1 z-50">
                <div className="px-3 py-2 text-sm text-muted border-b border-hair truncate">{user.email}</div>
                <ThemePicker skin={skin} setSkin={setSkin} theme={theme} onToggleTheme={onToggleTheme} />
                <div className="border-t border-hair pt-1">
                  <button
                    type="button"
                    onClick={logout}
                    className="w-full text-left px-3 py-2 text-sm text-muted hover:bg-raise hover:text-ink transition rounded-lg"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
