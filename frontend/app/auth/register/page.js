"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Mail, Lock, User, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { registerUser } from "@/services/auth";

function safeReturnPath(value) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  )
    return "";
  if (value.startsWith("/auth/login") || value.startsWith("/auth/register"))
    return "";
  return value;
}

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "STUDENT",
  });
  const [loading, setLoading] = useState(false);
  const [returnTo, setReturnTo] = useState("");

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("next");
    setReturnTo(safeReturnPath(requested));
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);

    try {
      const result = await registerUser(form);
      const role = String(result?.user?.role || form.role).toUpperCase();
      const requested = safeReturnPath(
        new URLSearchParams(window.location.search).get("next"),
      );
      const dashboard =
        role === "TEACHER"
          ? "/teacher/dashboard"
          : role === "STUDENT" &&
              (requested || returnTo).startsWith("/student/")
            ? requested || returnTo
            : "/student/dashboard";

      toast.success(
        dashboard.startsWith("/student/courses/")
          ? "Account created. Opening the shared course…"
          : "Account created successfully. Redirecting to your dashboard.",
      );
      router.replace(dashboard);
      router.refresh();
    } catch (error) {
      toast.error(error?.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="container-page flex min-h-screen items-center justify-center py-10">
        <div className="grid w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card lg:grid-cols-2">
          <div className="hidden bg-slate-900 p-10 text-white lg:flex lg:flex-col lg:justify-between">
            <div>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                <BookOpen className="h-6 w-6" />
              </div>
              <h1 className="mt-6 text-4xl font-bold tracking-tight">
                Create your account
              </h1>
              <p className="mt-4 max-w-md text-white/80">
                Join LearnMate AI to learn, teach, and use AI-powered study
                tools.
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 p-5">
              <p className="text-sm text-white/80">
                Choose Student or Teacher. Admin accounts are created
                separately.
              </p>
            </div>
          </div>

          <div className="p-6 sm:p-10">
            <div className="max-w-md">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                Register
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Create your account to get started.
              </p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      className="input-ui pl-11"
                      value={form.full_name}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, full_name: e.target.value }))
                      }
                      required
                      minLength={2}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      autoComplete="email"
                      className="input-ui pl-11"
                      value={form.email}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, email: e.target.value }))
                      }
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      autoComplete="new-password"
                      className="input-ui pl-11"
                      value={form.password}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, password: e.target.value }))
                      }
                      required
                      minLength={8}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Use at least 8 characters with a letter and a number.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Role
                  </label>
                  <select
                    className="input-ui"
                    value={form.role}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, role: e.target.value }))
                    }
                  >
                    <option value="STUDENT">Student</option>
                    <option value="TEACHER">Teacher</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="btn-primary w-full"
                  disabled={loading}
                >
                  {loading ? "Creating account..." : "Create Account"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </button>
              </form>

              <p className="mt-6 text-sm text-slate-600">
                Already have an account?{" "}
                <Link
                  href={
                    returnTo
                      ? `/auth/login?next=${encodeURIComponent(returnTo)}`
                      : "/auth/login"
                  }
                  className="font-medium text-blue-600 hover:text-blue-700"
                >
                  Login
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
