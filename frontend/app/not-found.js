import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="card-ui w-full max-w-md p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
          <SearchX className="h-8 w-8" />
        </div>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-900">
          Page not found
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link href="/" className="btn-primary mt-6">
          Go Home
        </Link>
      </div>
    </main>
  );
}