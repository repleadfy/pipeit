import { useAuth } from "../lib/auth.js";
import { Navigate } from "react-router-dom";

export function LoginPage() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-gray-100">
      <div className="w-full max-w-sm space-y-6 p-8">
        <h1 className="text-2xl font-bold text-center">Sign in to mpipe</h1>
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
          const form = new FormData(e.currentTarget);
          const res = await fetch("/auth/email/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
          });
          if (res.ok) window.location.href = "/";
        }}>
          <input name="email" type="email" placeholder="Email" required className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-gray-100 placeholder-gray-500" />
          <input name="password" type="password" placeholder="Password" required className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-gray-100 placeholder-gray-500" />
          <button type="submit" className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500 transition">Sign in</button>
        </form>
      </div>
    </div>
  );
}
