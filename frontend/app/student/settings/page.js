"use client";

import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";

export default function StudentSettingsPage() {
  const user = { full_name: "Student", role: "Student" };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <Sidebar role="student" />
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            title="Settings"
            subtitle="Customize your learning preferences"
            user={user}
          />

          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl space-y-6">
              <PageHeader
                title="Student Settings"
                description="Manage your preferences, notifications, and account security."
              />

              <section className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Preferences
                  </h3>
                  <div className="mt-5 space-y-4">
                    <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 px-4 py-3">
                      <span className="text-sm font-medium text-slate-700">
                        Dark Mode
                      </span>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300"
                      />
                    </label>

                    <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 px-4 py-3">
                      <span className="text-sm font-medium text-slate-700">
                        Email Notifications
                      </span>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300"
                        defaultChecked
                      />
                    </label>

                    <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 px-4 py-3">
                      <span className="text-sm font-medium text-slate-700">
                        AI Study Tips
                      </span>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300"
                        defaultChecked
                      />
                    </label>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Security
                  </h3>
                  <form className="mt-5 grid gap-5 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Current Password
                      </label>
                      <input
                        type="password"
                        className="input-ui"
                        placeholder="Enter current password"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        New Password
                      </label>
                      <input
                        type="password"
                        className="input-ui"
                        placeholder="Enter new password"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Confirm Password
                      </label>
                      <input
                        type="password"
                        className="input-ui"
                        placeholder="Confirm password"
                      />
                    </div>

                    <div className="md:col-span-2 flex justify-end">
                      <button type="submit" className="btn-primary">
                        Update Password
                      </button>
                    </div>
                  </form>
                </Card>
              </section>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
