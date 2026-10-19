"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Mail, Lock, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { loginUser } from "@/services/auth";

function dashboardForRole(role) {
  const normalized = String(role || "").toUpperCase();
  if (normalized === "ADMIN") return "/admin/dashboard";
  if (normalized === "TEACHER") return "/teacher/dashboard";
  return "/student/dashboard";
}

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

function destinationAfterLogin(role, returnPath) {
  const normalized = String(role || "").toUpperCase();
  // Shared course destinations are student routes; do not redirect a teacher
  // or admin account into a student page that they cannot use.
  if (normalized === "STUDENT" && returnPath.startsWith("/student/"))
    return returnPath;
  return dashboardForRole(normalized);
}

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
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
      const result = await loginUser(form);
      toast.success("Login successful");
      const requested = safeReturnPath(
        new URLSearchParams(window.location.search).get("next"),
      );
      router.replace(
        destinationAfterLogin(result?.user?.role, requested || returnTo),
      );
    } catch (error) {
      toast.error(
        error?.message || "Login failed. Please check your email and password.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="container-page flex min-h-screen items-center justify-center py-10">
        <div className="grid w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card lg:grid-cols-2">
          <div className="hidden bg-blue-600 p-10 text-white lg:flex lg:flex-col lg:justify-between">
            <div>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                <BookOpen className="h-6 w-6" />
              </div>
              <h1 className="mt-6 text-4xl font-bold tracking-tight">
                Welcome back
              </h1>
              <p className="mt-4 max-w-md text-white/80">
                Sign in to continue learning, track progress, and use AI support
                inside LearnMate AI.
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 p-5">
              <p className="text-sm text-white/80">
                Secure authentication with JWT access and refresh tokens.
              </p>
            </div>
          </div>

          <div className="p-6 sm:p-10">
            <div className="max-w-md">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                Login
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Enter your account details to continue.
              </p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
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
                      autoComplete="current-password"
                      className="input-ui pl-11"
                      value={form.password}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, password: e.target.value }))
                      }
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Remember me
                  </label>
                  <Link
                    href="/auth/forgot-password"
                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    Forgot password?
                  </Link>
                </div>

                <button
                  type="submit"
                  className="btn-primary w-full"
                  disabled={loading}
                >
                  {loading ? "Signing in..." : "Login"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </button>
              </form>

              <p className="mt-6 text-sm text-slate-600">
                Don’t have an account?{" "}
                <Link
                  href={
                    returnTo
                      ? `/auth/register?next=${encodeURIComponent(returnTo)}`
                      : "/auth/register"
                  }
                  className="font-medium text-blue-600 hover:text-blue-700"
                >
                  Register
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
