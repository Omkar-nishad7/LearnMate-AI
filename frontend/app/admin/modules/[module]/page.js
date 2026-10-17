import Link from "next/link";
import { ArrowLeft, Construction, ExternalLink } from "lucide-react";

const MODULES = {
  payments: {
    title: "Subscriptions & payments",
    reason:
      "The current project has no payment transaction, invoice, subscription or payment-provider integration. Financial figures, refunds and cancellations cannot be safely implemented from existing data.",
    needed: [
      "Payment provider integration",
      "Transaction and invoice schema",
      "Webhook signature validation",
      "Refund and cancellation workflows",
    ],
  },
  coupons: {
    title: "Coupons",
    reason:
      "There is no coupon or promotion model in the current database. Codes and redemption counts must not be shown as if they were real records.",
    needed: [
      "Persistent coupon and redemption tables",
      "Discount validation in checkout",
      "Expiry and usage-limit enforcement",
      "Audit logs for coupon changes",
    ],
  },
  reviews: {
    title: "Course reviews",
    reason:
      "The current project does not contain a course-review model or review moderation API.",
    needed: [
      "Review and rating schema",
      "Eligibility rules for reviewers",
      "Moderation APIs and audit trail",
      "Teacher response and pinning support",
    ],
  },
  reports: {
    title: "Reports & moderation",
    reason:
      "There is no user-generated report/case model yet. A report queue, resolution status and evidence history require persisted case records.",
    needed: [
      "Report/case schema",
      "Report creation in student and teacher interfaces",
      "Assignment and resolution workflows",
      "Warnings and moderation audit events",
    ],
  },
  backup: {
    title: "Database backup",
    reason:
      "The repository contains deployment/backup scripts, but the current Admin API does not expose a verified backup history, scheduler or restore workflow. Restore is intentionally not simulated in the dashboard.",
    needed: [
      "Verified backup job and retention policy",
      "Backup history table",
      "Secure object storage and access controls",
      "Restore validation and recovery procedure",
    ],
  },
};

export default async function AdminModulePage({ params }) {
  const { module } = await params;
  const data = MODULES[module] || {
    title: "Platform module",
    reason: "This module is not configured in the current project baseline.",
    needed: [
      "Persistent data model",
      "Authorization rules",
      "API endpoints and tests",
    ],
  };
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/admin/dashboard"
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-blue-600"
      >
        <ArrowLeft size={14} /> Back to dashboard
      </Link>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
          <Construction size={23} />
        </span>
        <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700">
          Not configured in current baseline
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          {data.title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          {data.reason}
        </p>
        <div className="mt-7 rounded-2xl bg-slate-50 p-5">
          <h2 className="text-sm font-semibold text-slate-900">
            Required before this module can be enabled
          </h2>
          <ul className="mt-3 space-y-2">
            {data.needed.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 text-xs leading-5 text-slate-600"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-6 flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-xs leading-5 text-blue-900">
          <ExternalLink size={16} className="mt-0.5 shrink-0" />
          <p>
            This panel intentionally avoids mock rows, fake totals or
            destructive buttons. It can be completed after the supporting data
            model and provider workflow are added.
          </p>
        </div>
      </section>
    </div>
  );
}
