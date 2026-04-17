import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2">404</h1>
        <p className="text-gray-400 mb-4">Document not found</p>
        <Link to="/" className="text-indigo-400 hover:text-indigo-300 text-sm">
          Back to home
        </Link>
      </div>
    </div>
  );
}
