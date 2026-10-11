"use client";

import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";

export default function DashboardShell({
  role = "student",
  title,
  subtitle,
  user,
  children,
  actions,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Prevent background page scrolling when mobile sidebar is open
  useEffect(() => {
    if (!sidebarOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [sidebarOpen]);

  // Close mobile sidebar when switching to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false);
        document.body.style.overflow = "";
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50">
      <Sidebar
        role={role}
        open={sidebarOpen}
        onOpen={() => setSidebarOpen(true)}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content */}
      <div className="min-h-screen lg:pl-72">
        <Navbar
          title={title}
          subtitle={subtitle}
          onMenuClick={() => setSidebarOpen(true)}
          user={user}
          actions={actions}
        />

        <main className="min-h-[calc(100vh-4rem)] px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}