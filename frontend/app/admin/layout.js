"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import Loader from "@/components/ui/Loader";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminTopbar from "@/components/admin/AdminTopbar";

export default function AdminLayout({ children }) {
  const { user, loading } = useAuth({ required: true, role: "ADMIN" });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading)
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
          <Loader className="h-5 w-5" />
          Checking administrator access…
        </div>
      </main>
    );

  return (
    <div className="min-h-screen bg-[#f7f8fb] text-slate-900">
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <AdminTopbar
        user={user}
        onMenuClick={() => setSidebarOpen((value) => !value)}
      />
      <div className="min-w-0 pt-[72px] lg:pl-[264px]">
        <main className="mx-auto max-w-[1800px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
        <footer className="border-t border-slate-200/80 px-4 py-5 text-center text-[11px] text-slate-400 sm:px-6 lg:px-8">
          LearnMate AI Platform Console <span className="mx-1.5">·</span>{" "}
          Administrative actions are logged
        </footer>
      </div>
    </div>
  );
}
