import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="relative text-xs font-medium px-2.5 py-1 rounded-lg bg-surface border border-hair text-muted hover:text-ink transition after:absolute after:-inset-[9px] after:content-['']"
      aria-label={copied ? "Copied" : "Copy"}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
