import { useAuth } from "../lib/auth.js";
import { useState } from "react";

interface HeaderProps {
  onToggleTOC: () => void;
  onToggleSearch: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

export function Header({ onToggleTOC, onToggleSearch, theme, onToggleTheme }: HeaderProps) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-2 bg-gray-950/80 backdrop-blur border-b border-gray-800">
      <button onClick={onToggleTOC} className="px-2 py-1 rounded text-sm text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition">
        &#9776; TOC
      </button>
      <div className="flex items-center gap-2">
        <button onClick={onToggleSearch} className="px-2 py-1 rounded text-sm text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition">
          &#x1F50D;
        </button>
        <kbd className="hidden sm:inline text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded border border-gray-700">&#x2318;K</kbd>
        {user && (
          <div className="relative">
            <button onClick={() => setMenuOpen(!menuOpen)} className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white">
              {user.avatar_url ? <img src={user.avatar_url} className="w-7 h-7 rounded-full" /> : user.name[0].toUpperCase()}
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-800 rounded-lg shadow-xl py-1 z-50">
                <div className="px-3 py-2 text-sm text-gray-400 border-b border-gray-800">{user.email}</div>
                <button onClick={onToggleTheme} className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 transition">
                  {theme === "dark" ? "Light mode" : "Dark mode"}
                </button>
                <button onClick={logout} className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 transition">
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
