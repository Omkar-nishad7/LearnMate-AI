"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { session, getCurrentUser } from "@/lib/auth";

export function useAuth({ required = false, role } = {}) {
  const router = useRouter();
  const [user, setUser] = useState(session.user);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        if (!session.access) {
          if (required) router.replace("/auth/login");
          return;
        }

        const currentUser = await getCurrentUser();
        const data = currentUser?.data || currentUser?.user || currentUser;
        if (data) setUser(data);

        if (role && data?.role && String(data.role).toUpperCase() !== String(role).toUpperCase()) {
          router.replace(String(data.role).toUpperCase() === "TEACHER" ? "/teacher/dashboard" : "/student/dashboard");
          return;
        }
      } catch {
        session.clear();
        if (required) router.replace("/auth/login");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [required, role, router]);

  return { user, loading, setUser };
}