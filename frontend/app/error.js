"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="card-ui w-full max-w-md p-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Something went wrong
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          There was a problem loading this page.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button onClick={reset} className="btn-primary">
            Try again
          </button>
          <Link href="/" className="btn-secondary">
            Go Home
          </Link>
        </div>
      </div>
    </main>
  );
}