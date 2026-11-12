import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-4">
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold">404 - Page Not Found</h2>
        <p className="text-sm text-slate-400">The page you requested could not be found.</p>
        <Link
          href="/"
          className="inline-block px-4 py-2 rounded-xl bg-brand-600 text-white font-medium hover:bg-brand-500 transition-colors"
        >
          Return to Studio
        </Link>
      </div>
    </div>
  );
}
