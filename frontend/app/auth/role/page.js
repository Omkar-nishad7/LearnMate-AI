"use client";

import { useRouter } from "next/navigation";
import AuthLayout from "@/components/layout/AuthLayout";

export default function RolePage() {
  const router = useRouter();

  return (
    <AuthLayout
      title="Choose role"
      description="Select how you want to use LearnMate AI."
    >
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Select your role
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          This helps us show the right dashboard and features.
        </p>

        <div className="mt-8 grid gap-4">
          <button
            type="button"
            onClick={() => router.push("/auth/register")}
            className="rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:border-blue-200 hover:bg-blue-50/60"
          >
            <h2 className="text-lg font-semibold text-slate-900">Student</h2>
            <p className="mt-1 text-sm text-slate-500">
              Learn courses, watch videos, take quizzes, and use AI tutor.
            </p>
          </button>

          <button
            type="button"
            onClick={() => router.push("/auth/register")}
            className="rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:border-blue-200 hover:bg-blue-50/60"
          >
            <h2 className="text-lg font-semibold text-slate-900">Teacher</h2>
            <p className="mt-1 text-sm text-slate-500">
              Manage courses, students, assignments, and analytics.
            </p>
          </button>
        </div>
      </div>
    </AuthLayout>
  );
}
