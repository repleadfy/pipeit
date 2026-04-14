import { useEffect } from "react";

export function useKeyboard(key: string, metaKey: boolean, handler: () => void) {
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === key && (metaKey ? e.metaKey || e.ctrlKey : true)) {
        e.preventDefault();
        handler();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [key, metaKey, handler]);
}
