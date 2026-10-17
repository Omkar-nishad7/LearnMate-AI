"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, LogOut, Menu, Search, Shield } from "lucide-react";
import { toast } from "sonner";
import { logoutUser } from "@/services/auth";

export default function AdminTopbar({ user, onMenuClick }) {
  const [query, setQuery] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();
  const name =
    user?.profile?.display_name ||
    user?.profile?.full_name ||
    user?.full_name ||
    "Administrator";

  async function logout() {
    setLoggingOut(true);
    try {
      await logoutUser();
    } catch {
      /* local session is cleared by logoutUser */
    }
    toast.success("Signed out successfully");
    router.replace("/auth/login");
  }

  function submitSearch(event) {
    event.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    router.push(`/admin/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <header className="fixed inset-x-0 top-0 z-30 flex h-[72px] items-center justify-between gap-3 border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl sm:px-6 lg:left-[264px] lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50 lg:hidden"
          aria-label="Open admin navigation"
        >
          <Menu size={18} />
        </button>
        <div className="hidden sm:block">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Workspace / Admin
          </p>
          <p className="mt-0.5 text-sm font-semibold text-slate-800">
            Platform overview
          </p>
        </div>
      </div>
      <form
        onSubmit={submitSearch}
        className="flex w-full max-w-[430px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 focus-within:border-blue-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-50"
      >
        <Search size={16} className="shrink-0 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400 sm:text-sm"
          placeholder="Search users, courses, files…"
          aria-label="Global admin search"
        />
        <kbd className="hidden rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] text-slate-400 sm:inline">
          ↵
        </kbd>
      </form>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <button
          onClick={() => router.push("/admin/announcements")}
          aria-label="Announcements"
          title="Announcements"
          className="relative rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50"
        >
          <Bell size={17} />
        </button>
        <div className="hidden h-8 w-px bg-slate-200 sm:block" />
        <div className="hidden text-right sm:block">
          <p className="max-w-28 truncate text-xs font-semibold text-slate-800">
            {name}
          </p>
          <p className="mt-0.5 flex items-center justify-end gap-1 text-[10px] font-medium text-blue-600">
            <Shield size={10} /> ADMIN
          </p>
        </div>
        <button
          disabled={loggingOut}
          onClick={logout}
          title="Log out"
          aria-label="Log out"
          className="rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
        >
          <LogOut size={17} />
        </button>
      </div>
    </header>
  );
}
