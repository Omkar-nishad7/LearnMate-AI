"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import AuthLayout from "@/components/layout/AuthLayout";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      toast.success("If the account exists, a reset email has been sent.");
    } catch (error) {
      toast.error(error?.message || "Unable to request a password reset.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Reset password" description="Request a secure password reset link.">
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-2xl font-bold text-slate-900">Forgot password?</h1>
        <p className="mt-2 text-sm text-slate-500">Enter your email address and we will send a reset link when the account exists.</p>
        <form onSubmit={submit} className="mt-8 space-y-5">
          <input
            type="email"
            className="input-ui"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button className="btn-primary w-full" disabled={loading} type="submit">
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>
        <p className="mt-6 text-sm text-slate-600">
          <Link href="/auth/login" className="font-medium text-blue-600">Back to login</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
