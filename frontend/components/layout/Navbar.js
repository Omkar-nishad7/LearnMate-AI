"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Menu, Bell, Search, ArrowRight } from "lucide-react";
import Avatar from "@/components/ui/Avatar";

function normalizeRole(role) {
  const value = String(role || "student").toLowerCase();
  return value === "teacher" ? "teacher" : "student";
}

export default function Navbar({
  title,
  subtitle,
  user,
  onMenuClick,
  actions,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const role = normalizeRole(user?.role);
  const [query, setQuery] = useState("");

  function submitSearch(event) {
    event.preventDefault();
    const value = query.trim();
    if (value.length < 2) return;
    router.push(`/${role}/search?q=${encodeURIComponent(value)}`);
  }

  const profilePath = pathname?.startsWith("/teacher")
    ? "/teacher/profile"
    : "/student/profile";

  return (
    <header
      data-learnmate-navbar="true"
      className="fixed inset-x-0 top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur lg:left-72"
    >
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (onMenuClick) {
                onMenuClick();
              } else {
                window.dispatchEvent(new Event("learnmate:toggle-sidebar"));
              }
            }}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 lg:hidden"
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0">
            {title ? (
              <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900">
                {title}
              </h1>
            ) : null}
            {subtitle ? (
              <p className="truncate text-sm text-slate-500">{subtitle}</p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <form
            onSubmit={submitSearch}
            className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 md:flex"
          >
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search LearnMate..."
              className="w-44 bg-transparent text-sm outline-none placeholder:text-slate-400"
              aria-label="Search LearnMate"
            />
            <button
              type="submit"
              aria-label="Run search"
              className="text-slate-400 transition hover:text-blue-600"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <Link
            href={`/${role}/search`}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 md:hidden"
            aria-label="Open search"
          >
            <Search className="h-5 w-5" />
          </Link>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
          </button>

          {actions ? <div className="hidden sm:block">{actions}</div> : null}

          {user ? (
            <Link href={profilePath} className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-slate-900">
                  {user.full_name || user.name || "User"}
                </p>
                <p className="text-xs text-slate-500 capitalize">
                  {user.role || "member"}
                </p>
              </div>
              <Avatar name={user.full_name || user.name || "User"} />
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
