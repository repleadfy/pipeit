import type { DocFormat } from "@pipeit/shared";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Skin } from "../hooks/useTheme.js";
import { useAuth } from "../lib/auth.js";
import { DocActions } from "./DocActions.js";
import { LogoMark, MenuIcon, SearchIcon, UploadIcon } from "./icons.js";
import { ThemePicker } from "./ThemePicker.js";

interface HeaderProps {
  /** Opens the mobile TOC drawer. Omit on surfaces without a table of contents (e.g. the home). */
  onToggleTOC?: () => void;
  /** Opens the doc search panel. Omit where the page owns its own search (e.g. the home). */
  onToggleSearch?: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  skin: Skin;
  setSkin: (s: Skin) => void;
  docTitle?: string;
  exportDoc?: { slug: string; title: string; format: DocFormat; content: string };
}

export function Header({
  onToggleTOC,
  onToggleSearch,
  theme,
  onToggleTheme,
  skin,
  setSkin,
  docTitle,
  exportDoc,
}: HeaderProps) {
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
    "inline-flex items-center justify-center gap-1.5 min-h-9 px-2.5 rounded-lg text-sm font-medium text-muted hover:text-ink hover:bg-raise active:scale-[0.97] transition duration-200";

  return (
    <header className="sticky top-0 z-40 flex items-center gap-3 px-4 py-2 bg-app/80 backdrop-blur border-b border-hair print:hidden">
      {onToggleTOC && (
        <button type="button" onClick={onToggleTOC} className={`lg:hidden ${ghost}`} aria-label="Table of contents">
          <MenuIcon />
        </button>
      )}
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 shrink-0 font-heading font-bold tracking-tight text-ink rounded-md"
        aria-label="pipeit home"
      >
        <LogoMark size={16} className="translate-y-px" />
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
        {exportDoc && <DocActions {...exportDoc} />}
        {user && (
          <Link to="/upload" className={`hidden sm:inline-flex ${ghost}`} aria-label="Upload a document">
            <UploadIcon />
            Upload
          </Link>
        )}
        {onToggleSearch && (
          <button type="button" onClick={onToggleSearch} className={ghost} aria-label="Search your docs">
            <SearchIcon />
            <kbd className="hidden sm:inline text-[11px] font-mono text-muted bg-surface px-1.5 py-0.5 rounded-md border border-hair">
              &#x2318;K
            </kbd>
          </button>
        )}
        {user && (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-label="Account menu"
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs font-bold text-on-accent overflow-hidden ring-2 ring-transparent hover:ring-accent/30 active:scale-95 transition duration-200"
            >
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full" />
              ) : (
                user.name[0].toUpperCase()
              )}
            </button>
            {menuOpen && (
              <div className="pi-pop absolute right-0 mt-2 w-60 bg-surface border border-hair rounded-xl shadow-xl shadow-black/5 dark:shadow-black/30 py-1 z-50">
                <div className="px-3 py-2 text-sm text-muted border-b border-hair truncate">{user.email}</div>
                <ThemePicker skin={skin} setSkin={setSkin} theme={theme} onToggleTheme={onToggleTheme} />
                <div className="border-t border-hair pt-1 px-1 pb-1">
                  <button
                    type="button"
                    onClick={logout}
                    className="w-full text-left px-2 py-2 text-sm text-muted hover:bg-raise hover:text-ink transition duration-200 rounded-lg"
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
