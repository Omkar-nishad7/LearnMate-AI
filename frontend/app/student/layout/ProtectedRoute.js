"use client";

import Loader from "@/components/ui/Loader";
import { useAuth } from "@/hooks/useAuth";

export default function ProtectedRoute({ children, role }) {
  const { loading } = useAuth({ required: true, role });

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="card-ui flex items-center gap-3 px-5 py-4">
          <Loader className="h-5 w-5" />
          <p className="text-sm font-medium text-slate-600">Checking session...</p>
        </div>
      </main>
    );
  }

  return children;
}