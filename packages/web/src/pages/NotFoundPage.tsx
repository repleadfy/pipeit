import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-app text-ink">
      <div className="text-center">
        <h1 className="font-heading text-5xl font-bold mb-2">404</h1>
        <p className="text-muted mb-4">Document not found</p>
        <Link to="/" className="text-accent hover:opacity-80 text-sm font-medium">
          Back to home
        </Link>
      </div>
    </div>
  );
}
