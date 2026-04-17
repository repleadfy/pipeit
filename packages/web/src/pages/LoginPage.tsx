import { useState } from "react";
import { useAuth } from "../lib/auth.js";
import { Navigate } from "react-router-dom";

export function LoginPage() {
  const { user, loading } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="w-full max-w-sm space-y-6 p-8">
        <h1 className="text-2xl font-bold text-center">{isSignUp ? "Create an account" : "Sign in to mpipe"}</h1>
        <div className="space-y-3">
          <a href="/auth/google" className="block w-full text-center py-2.5 px-4 rounded-lg bg-white text-gray-900 font-medium hover:bg-gray-100 transition">
            Continue with Google
          </a>
          <a href="/auth/github" className="block w-full text-center py-2.5 px-4 rounded-lg bg-gray-800 text-white font-medium hover:bg-gray-700 transition">
            Continue with GitHub
          </a>
        </div>
        <div className="flex items-center gap-3 text-gray-500 text-sm">
          <div className="flex-1 h-px bg-gray-800" /><span>or</span><div className="flex-1 h-px bg-gray-800" />
        </div>
        <form className="space-y-3" onSubmit={async (e) => {
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
            window.location.href = "/";
          } else {
            const data = await res.json().catch(() => ({}));
            setError(data.error || "Something went wrong");
          }
        }}>
          {isSignUp && (
            <input name="name" type="text" placeholder="Name" required className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-gray-100 placeholder-gray-500" />
          )}
          <input name="email" type="email" placeholder="Email" required className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-gray-100 placeholder-gray-500" />
          <input name="password" type="password" placeholder="Password" required className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-gray-100 placeholder-gray-500" />
          {error && <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/30 rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500 transition">
            {isSignUp ? "Create account" : "Sign in"}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button type="button" onClick={() => { setIsSignUp(!isSignUp); setError(""); }} className="text-indigo-400 hover:text-indigo-300">
            {isSignUp ? "Sign in" : "Sign up"}
          </button>
        </p>
      </div>
    </div>
  );
}
