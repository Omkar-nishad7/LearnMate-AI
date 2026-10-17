"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { session, getCurrentUser } from "@/lib/auth";

function dashboardForRole(role) {
  const normalized = String(role || "").toUpperCase();
  if (normalized === "ADMIN") return "/admin/dashboard";
  if (normalized === "TEACHER") return "/teacher/dashboard";
  return "/student/dashboard";
}

export function useAuth({ required = false, role } = {}) {
  const router = useRouter();
  const [user, setUser] = useState(session.user);
  // Use the cached session to render the page immediately. The backend still
  // validates the token and every protected API request remains authenticated.
  const [loading, setLoading] = useState(
    !(session.access && session.user),
  );

  useEffect(() => {
    let cancelled = false;
    const cachedUser = session.user;

    if (!session.access) {
      setLoading(false);
      if (required) router.replace("/auth/login");
      return () => { cancelled = true; };
    }

    if (cachedUser) {
      setUser(cachedUser);
      if (role && cachedUser.role && String(cachedUser.role).toUpperCase() !== String(role).toUpperCase()) {
        router.replace(dashboardForRole(cachedUser.role));
      }
      setLoading(false);
    }

    const run = async () => {
      try {
        const currentUser = await getCurrentUser();
        const data = currentUser?.data || currentUser?.user || currentUser;
        if (cancelled) return;
        if (data) setUser(data);

        if (role && data?.role && String(data.role).toUpperCase() !== String(role).toUpperCase()) {
          router.replace(dashboardForRole(data.role));
        }
      } catch {
        if (cancelled) return;
        session.clear();
        if (required) router.replace("/auth/login");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [required, role, router]);

  return { user, loading, setUser };
}