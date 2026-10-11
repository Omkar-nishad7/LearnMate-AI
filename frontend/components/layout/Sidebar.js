"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  X,
  LayoutDashboard,
  BookOpen,
  Brain,
  FileText,
  ClipboardList,
  Users,
  BarChart3,
  UserRound,
  Settings,
  Bell,
  LogOut,
  Video,
  Search,
  Youtube,
  MoreHorizontal,
  ChevronDown,
  Plus,
  Edit3,
} from "lucide-react";

const STUDENT_LINKS = [
  { href: "/student/search", label: "Search", icon: Search },
  { href: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/student/courses", label: "Courses", icon: BookOpen },
  { href: "/student/videos", label: "My Videos", icon: Video },
  { href: "/student/videos/import", label: "Import YouTube", icon: Youtube },
  { href: "/student/notes", label: "Notes", icon: FileText },
  { href: "/student/quizzes", label: "Quizzes", icon: ClipboardList },
  { href: "/student/assignments", label: "Assignments", icon: ClipboardList },
  { href: "/student/ai-chat", label: "AI Tutor", icon: Brain },
  { href: "/student/notifications", label: "Notifications", icon: Bell },
  { href: "/student/profile", label: "Profile", icon: UserRound },
  { href: "/student/settings", label: "Settings", icon: Settings },
];

const TEACHER_LINKS = [
  { href: "/teacher/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    type: "courses",
    href: "/teacher/courses",
    label: "Courses",
    icon: BookOpen,
  },
  { href: "/teacher/videos", label: "Content Studio", icon: Video },
  { href: "/teacher/assignments", label: "Assignments", icon: ClipboardList },
  { href: "/teacher/students", label: "Students", icon: Users },
  { href: "/teacher/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/teacher/notifications", label: "Notifications", icon: Bell },
  { href: "/teacher/communications", label: "Course Updates", icon: Bell },
  { href: "/teacher/profile", label: "Profile", icon: UserRound },
  { href: "/teacher/settings", label: "Settings", icon: Settings },
];

const MOBILE_STUDENT = [
  { href: "/student/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/student/courses", label: "Courses", icon: BookOpen },
  { href: "/student/videos", label: "Videos", icon: Video },
  { href: "/student/ai-chat", label: "Tutor", icon: Brain },
];

const MOBILE_TEACHER = [
  { href: "/teacher/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/teacher/courses", label: "Courses", icon: BookOpen },
  { href: "/teacher/videos", label: "Studio", icon: Video },
  { href: "/teacher/students", label: "Students", icon: Users },
];

function isActive(pathname, href) {
  if (href.endsWith("/dashboard")) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Sidebar({ role = "student", open, onOpen, onClose }) {
  const pathname = usePathname();
  const controlled = typeof open === "boolean";
  const [internalOpen, setInternalOpen] = useState(false);
  const [coursesExpanded, setCoursesExpanded] = useState(false);

  const drawerOpen = controlled ? open : internalOpen;
  const links = useMemo(
    () => (role === "teacher" ? TEACHER_LINKS : STUDENT_LINKS),
    [role],
  );
  const mobileLinks = role === "teacher" ? MOBILE_TEACHER : MOBILE_STUDENT;

  useEffect(() => {
    if (role === "teacher" && pathname.startsWith("/teacher/courses")) {
      setCoursesExpanded(true);
    }
  }, [role, pathname]);

  const closeDrawer = () => {
    if (controlled) {
      onClose?.();
    } else {
      setInternalOpen(false);
    }
  };

  const openDrawer = () => {
    if (controlled) {
      onOpen?.();
    } else {
      setInternalOpen(true);
    }
  };

  const toggleDrawer = () => {
    if (controlled) {
      if (drawerOpen) onClose?.();
      else onOpen?.();
      return;
    }
    setInternalOpen((value) => !value);
  };

  useEffect(() => {
    const toggle = () => toggleDrawer();
    const close = () => closeDrawer();

    window.addEventListener("learnmate:toggle-sidebar", toggle);
    window.addEventListener("learnmate:close-sidebar", close);

    return () => {
      window.removeEventListener("learnmate:toggle-sidebar", toggle);
      window.removeEventListener("learnmate:close-sidebar", close);
    };
    // The event handlers intentionally use the current prop/state closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlled, drawerOpen, onClose, onOpen]);

  useEffect(() => {
    if (!drawerOpen || typeof window === "undefined") return;

    if (window.innerWidth < 1024) {
      const previous = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previous;
      };
    }
    return undefined;
  }, [drawerOpen]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape" && drawerOpen) closeDrawer();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // closeDrawer intentionally maps to current controlled/uncontrolled state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerOpen]);

  return (
    <>
      {drawerOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={closeDrawer}
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden"
        />
      ) : null}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[88vw] flex-col",
          "border-r border-slate-200 bg-white shadow-xl",
          "transform transition-transform duration-200 ease-out",
          drawerOpen ? "translate-x-0" : "-translate-x-full",
          "lg:sticky lg:top-0 lg:h-screen lg:max-w-none lg:translate-x-0 lg:shadow-none",
          "lg:shrink-0",
        ].join(" ")}
        aria-label={`${role} navigation`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-5">
          <Link
            href={`/${role}/dashboard`}
            onClick={closeDrawer}
            className="min-w-0"
          >
            <h2 className="truncate text-lg font-bold tracking-tight text-slate-900">
              LearnMate AI
            </h2>
            <p className="text-xs capitalize text-slate-500">{role} Panel</p>
          </Link>

          <button
            type="button"
            onClick={closeDrawer}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          <div className="space-y-1">
            {links.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);

              if (role === "teacher" && item.type === "courses") {
                const expanded = coursesExpanded;
                return (
                  <div key="teacher-courses-nav" className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setCoursesExpanded((value) => !value)}
                      aria-expanded={expanded}
                      className={`sidebar-link min-h-11 w-full justify-between ${active ? "sidebar-link-active" : ""}`}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <BookOpen className="h-4 w-4 shrink-0" />
                        <span className="truncate">Courses</span>
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                      />
                    </button>
                    {expanded ? (
                      <div className="ml-4 space-y-1 border-l border-slate-200 pl-3">
                        <Link
                          href="/teacher/courses"
                          onClick={closeDrawer}
                          className={`sidebar-link min-h-9 text-sm ${pathname === "/teacher/courses" ? "sidebar-link-active" : ""}`}
                        >
                          <BookOpen className="h-4 w-4 shrink-0" />
                          <span>All Courses</span>
                        </Link>
                        <Link
                          href="/teacher/courses/new"
                          onClick={closeDrawer}
                          className={`sidebar-link min-h-9 text-sm ${pathname === "/teacher/courses/new" ? "sidebar-link-active" : ""}`}
                        >
                          <Plus className="h-4 w-4 shrink-0" />
                          <span>Create Course</span>
                        </Link>
                        <Link
                          href="/teacher/courses?mode=edit"
                          onClick={closeDrawer}
                          className="sidebar-link min-h-9 text-sm"
                        >
                          <Edit3 className="h-4 w-4 shrink-0" />
                          <span>Edit Course</span>
                        </Link>
                      </div>
                    ) : null}
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeDrawer}
                  aria-current={active ? "page" : undefined}
                  className={`sidebar-link min-h-11 ${active ? "sidebar-link-active" : ""}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>

          {role === "teacher" ? (
            <div className="mt-6 border-t border-slate-200 pt-4">
              <Link
                href="/"
                onClick={closeDrawer}
                className="sidebar-link min-h-11"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span>Logout</span>
              </Link>
            </div>
          ) : (
            <div className="mt-6 border-t border-slate-200 pt-4">
              <Link
                href={`/${role}/profile`}
                onClick={closeDrawer}
                className="sidebar-link min-h-11"
              >
                <UserRound className="h-4 w-4 shrink-0" />
                <span>Profile</span>
              </Link>
              <Link
                href={`/${role}/settings`}
                onClick={closeDrawer}
                className="sidebar-link min-h-11"
              >
                <Settings className="h-4 w-4 shrink-0" />
                <span>Settings</span>
              </Link>
              <Link
                href="/"
                onClick={closeDrawer}
                className="sidebar-link min-h-11"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span>Logout</span>
              </Link>
            </div>
          )}
        </nav>
      </aside>

      <nav
        className="fixed inset-x-0 bottom-0 z-[60] border-t border-slate-200 bg-white/95 px-2 pt-2 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden"
        style={{
          paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))",
        }}
        aria-label="Mobile quick navigation"
      >
        <div className="mx-auto flex max-w-lg gap-1">
          {mobileLinks.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeDrawer}
                className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium ${
                  active
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={openDrawer}
            className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium text-slate-500 hover:bg-slate-50"
            aria-label="Open more navigation"
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
