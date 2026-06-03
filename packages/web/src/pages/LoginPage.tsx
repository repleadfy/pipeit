import { useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth.js";

export function LoginPage() {
  const { user, loading } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [searchParams] = useSearchParams();
  const rawReturnTo = searchParams.get("return_to") || "/";
  const returnTo = /^\/(?![/\\])/.test(rawReturnTo) ? rawReturnTo : "/";

  if (loading) return null;
  if (user) return <Navigate to={returnTo} replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-app text-ink">
      <div className="w-full max-w-sm space-y-6 p-8">
        <h1 className="font-heading text-2xl font-bold text-center">
          {isSignUp ? "Create an account" : "Sign in to pipeit"}
        </h1>
        <div className="space-y-3">
          <a
            href={`/auth/google${returnTo !== "/" ? `?return_to=${encodeURIComponent(returnTo)}` : ""}`}
            className="block w-full text-center py-2.5 px-4 rounded-lg bg-surface border border-hair text-ink font-medium hover:bg-raise transition"
          >
            Continue with Google
          </a>
          <a
            href={`/auth/github${returnTo !== "/" ? `?return_to=${encodeURIComponent(returnTo)}` : ""}`}
            className="block w-full text-center py-2.5 px-4 rounded-lg bg-ink text-app font-medium hover:opacity-90 transition"
          >
            Continue with GitHub
          </a>
        </div>
        <div className="flex items-center gap-3 text-muted text-sm">
          <div className="flex-1 h-px bg-hair" />
          <span>or</span>
          <div className="flex-1 h-px bg-hair" />
        </div>
        <form
          key={isSignUp ? "signup" : "signin"}
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            const form = new FormData(e.currentTarget);
            const endpoint = isSignUp ? "/auth/email/signup" : "/auth/email/login";
            const body: Record<string, unknown> = { email: form.get("email"), password: form.get("password") };
            if (isSignUp) body.name = form.get("name");
            const res = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(body),
            });
            if (res.ok) {
              const data = await res.json().catch(() => ({}));
              window.location.href = data.redirect || returnTo;
            } else {
              const data = await res.json().catch(() => ({}));
              setError(data.error || "Something went wrong");
            }
          }}
        >
          {isSignUp && (
            <input
              name="name"
              type="text"
              placeholder="Name"
              required
              className="w-full px-3 py-2 rounded-lg bg-raise border border-hair text-ink placeholder:text-muted focus:outline-none focus:border-accent"
            />
          )}
          <input
            name="email"
            type="email"
            placeholder="Email"
            required
            className="w-full px-3 py-2 rounded-lg bg-raise border border-hair text-ink placeholder:text-muted focus:outline-none focus:border-accent"
          />
          <input
            name="password"
            type="password"
            placeholder="Password"
            required
            className="w-full px-3 py-2 rounded-lg bg-raise border border-hair text-ink placeholder:text-muted focus:outline-none focus:border-accent"
          />
          {error && <p className="text-bad text-sm bg-bad/10 border border-bad/30 rounded-lg px-3 py-2">{error}</p>}
          <button
            type="submit"
            className="w-full py-2.5 rounded-lg bg-accent text-on-accent font-semibold hover:opacity-90 transition"
          >
            {isSignUp ? "Create account" : "Sign in"}
          </button>
        </form>
        <p className="text-center text-sm text-muted">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError("");
            }}
            className="text-accent hover:opacity-80 font-medium"
          >
            {isSignUp ? "Sign in" : "Sign up"}
          </button>
        </p>
      </div>
    </div>
  );
}
