import { useEffect, useState } from "react";

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
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="w-full max-w-md space-y-6 p-8 rounded-xl border border-gray-200 dark:border-gray-800">
        <h1 className="text-xl font-bold">Authorize access</h1>
        {error && <p className="text-sm text-red-500">{error}</p>}
        {info && (
          <>
            <p className="text-gray-700 dark:text-gray-300">
              <span className="font-medium">{info.client_name}</span> is requesting
              permission to upload markdown to your pipeit account.
            </p>
            <p className="text-xs text-gray-500">
              Request issued {new Date(info.issued_at).toLocaleString()}
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => decide("allow")}
                className="flex-1 py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500 disabled:opacity-50"
              >
                Allow
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => decide("deny")}
                className="flex-1 py-2.5 rounded-lg bg-gray-200 dark:bg-gray-800 font-medium hover:bg-gray-300 dark:hover:bg-gray-700 disabled:opacity-50"
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
