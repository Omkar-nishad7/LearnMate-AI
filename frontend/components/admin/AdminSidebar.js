"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  BookOpen,
  BrainCircuit,
  ChevronRight,
  CircleDollarSign,
  Database,
  FileText,
  Flag,
  FolderOpen,
  Gauge,
  Gift,
  LayoutDashboard,
  Megaphone,
  Settings2,
  ShieldCheck,
  Star,
  Users,
  UserCheck,
  X,
  LockKeyhole,
} from "lucide-react";

const items = [
  {
    label: "Dashboard",
    href: "/admin/dashboard",
    icon: LayoutDashboard,
    group: "Overview",
  },
  {
    label: "User management",
    href: "/admin/users",
    icon: Users,
    group: "Manage platform",
  },
  {
    label: "Teacher approval",
    href: "/admin/teachers",
    icon: UserCheck,
    group: "Manage platform",
  },
  {
    label: "Course management",
    href: "/admin/courses",
    icon: BookOpen,
    group: "Manage platform",
  },
  {
    label: "Learning content",
    href: "/admin/content",
    icon: FileText,
    group: "Manage platform",
  },
  {
    label: "AI management",
    href: "/admin/ai",
    icon: BrainCircuit,
    group: "Manage platform",
  },
  {
    label: "Analytics",
    href: "/admin/analytics",
    icon: BarChart3,
    group: "Insights",
  },
  {
    label: "Payments",
    href: "/admin/modules/payments",
    icon: CircleDollarSign,
    group: "Business",
  },
  {
    label: "Coupons",
    href: "/admin/modules/coupons",
    icon: Gift,
    group: "Business",
  },
  {
    label: "Announcements",
    href: "/admin/announcements",
    icon: Megaphone,
    group: "Communicate",
  },
  {
    label: "Reviews",
    href: "/admin/modules/reviews",
    icon: Star,
    group: "Communicate",
  },
  {
    label: "Reports",
    href: "/admin/modules/reports",
    icon: Flag,
    group: "Communicate",
  },
  {
    label: "File storage",
    href: "/admin/files",
    icon: FolderOpen,
    group: "Operations",
  },
  {
    label: "Security",
    href: "/admin/security",
    icon: ShieldCheck,
    group: "Operations",
  },
  {
    label: "Platform settings",
    href: "/admin/settings",
    icon: Settings2,
    group: "Operations",
  },
  {
    label: "Activity logs",
    href: "/admin/activity-logs",
    icon: Activity,
    group: "Operations",
  },
  {
    label: "Backup",
    href: "/admin/modules/backup",
    icon: Database,
    group: "Operations",
  },
];

function active(pathname, href) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminSidebar({ open = false, onClose }) {
  const pathname = usePathname();
  const groups = [...new Set(items.map((item) => item.group))];
  return (
    <>
      {open ? (
        <button
          aria-label="Close admin navigation"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm lg:hidden"
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[264px] max-w-[88vw] flex-col border-r border-slate-800 bg-[#101318] text-slate-300 shadow-2xl transition-transform duration-200 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-[72px] items-center justify-between border-b border-white/10 px-5">
          <Link
            href="/admin/dashboard"
            onClick={onClose}
            className="flex min-w-0 items-center gap-3"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500 text-white shadow-lg shadow-blue-500/20">
              <Gauge size={21} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold tracking-tight text-white">
                LearnMate AI
              </span>
              <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-300">
                Platform console
              </span>
            </span>
          </Link>
          <button
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 lg:hidden"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>
        <div className="mx-4 mt-4 rounded-xl border border-blue-400/20 bg-blue-500/10 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-200">
            <ShieldCheck size={15} /> Administrator access
          </div>
          <p className="mt-1 text-[11px] leading-4 text-slate-400">
            Platform-wide controls and oversight
          </p>
        </div>
        <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-5">
          {groups.map((group) => (
            <div key={group}>
              <p className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[0.19em] text-slate-500">
                {group}
              </p>
              <div className="space-y-1">
                {items
                  .filter((item) => item.group === group)
                  .map((item) => {
                    const Icon = item.icon;
                    const current = active(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        className={`group flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-[12px] font-medium transition ${current ? "bg-blue-500 text-white shadow-md shadow-blue-950/30" : "text-slate-400 hover:bg-white/[0.06] hover:text-white"}`}
                      >
                        <Icon
                          size={16}
                          className={
                            current
                              ? "text-white"
                              : "text-slate-500 group-hover:text-blue-300"
                          }
                        />
                        <span className="flex-1">{item.label}</span>
                        {[
                          "Payments",
                          "Coupons",
                          "Reviews",
                          "Reports",
                          "Backup",
                        ].includes(item.label) ? (
                          <span
                            title="Requires a supporting integration or data model"
                            className="rounded bg-white/5 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-slate-500"
                          >
                            Setup
                          </span>
                        ) : current ? (
                          <ChevronRight size={14} />
                        ) : null}
                      </Link>
                    );
                  })}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] p-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-700 text-white">
              <LockKeyhole size={15} />
            </span>
            <div>
              <p className="text-xs font-semibold text-slate-200">
                Secure workspace
              </p>
              <p className="mt-0.5 text-[10px] text-slate-500">
                Admin actions are audited
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
