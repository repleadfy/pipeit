import { Link } from "react-router-dom";
import { LogoMark } from "../components/icons.js";

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-app text-ink px-6">
      <div className="pi-rise text-center space-y-4 max-w-sm">
        <LogoMark size={28} className="mx-auto text-muted opacity-60" />
        <h1 className="font-heading text-5xl font-bold tracking-tight">404</h1>
        <p className="text-muted">This page doesn't exist. The document may have moved, or the link is private.</p>
        <Link
          to="/"
          className="inline-flex items-center px-4 py-2 rounded-lg bg-raise border border-hair text-sm font-medium text-ink hover:border-accent/50 active:scale-[0.98] transition duration-200"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
