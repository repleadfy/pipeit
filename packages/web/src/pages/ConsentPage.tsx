import { useEffect, useState } from "react";
import { LogoMark } from "../components/icons.js";

type ConsentInfo = { client_name: string; issued_at: number };

export function ConsentPage() {
  const [info, setInfo] = useState<ConsentInfo | null>(null);
  const [error, setError] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/mcp/consent-info", { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          setError(data.error || "unable to load authorization request");
          return;
        }
        setInfo(await r.json());
      })
      .catch(() => setError("network error"));
  }, []);

  async function decide(action: "allow" | "deny") {
    setSubmitting(true);
    try {
      const res = await fetch("/mcp/consent", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.redirect) {
        window.location.href = data.redirect;
        return;
      }
      setError(data.error || "something went wrong");
    } catch {
      setError("network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-app text-ink px-6">
      <div className="pi-rise w-full max-w-md space-y-6 p-8 rounded-card border border-hair bg-surface shadow-xl shadow-black/5 dark:shadow-black/30">
        <div className="flex items-center gap-2.5">
          <LogoMark size={20} className="text-ink" />
          <h1 className="font-heading text-xl font-bold tracking-tight">Authorize access</h1>
        </div>
        {error && <p className="text-sm text-bad bg-bad/10 border border-bad/30 rounded-lg px-3 py-2">{error}</p>}
        {info && (
          <>
            <p className="text-ink/90">
              <span className="font-semibold">{info.client_name}</span> is requesting permission to upload markdown to
              your pipeit account.
            </p>
            <p className="text-xs text-muted">Request issued {new Date(info.issued_at).toLocaleString()}</p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => decide("allow")}
                className="flex-1 py-2.5 rounded-lg bg-accent text-on-accent text-sm font-semibold hover:opacity-90 active:scale-[0.98] disabled:opacity-50 transition duration-200"
              >
                Allow
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => decide("deny")}
                className="flex-1 py-2.5 rounded-lg bg-raise border border-hair text-sm font-medium text-muted hover:text-ink active:scale-[0.98] disabled:opacity-50 transition duration-200"
              >
                Deny
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
