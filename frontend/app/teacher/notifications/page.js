"use client";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/services/notifications";
export default function NotificationsPage() {
  const [items, setItems] = useState([]),
    [error, setError] = useState("");
  async function load() {
    try {
      const d = await fetchNotifications();
      setItems(d?.items || d || []);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <Sidebar role="teacher" />
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            title="Notifications"
            subtitle="Real account notifications"
            user={{ full_name: "Teacher", role: "Teacher" }}
          />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl space-y-6">
              <PageHeader
                title="Notifications"
                description="Only notifications created by the application are shown."
                action={
                  <button
                    onClick={async () => {
                      await markAllNotificationsRead();
                      load();
                    }}
                    className="btn-secondary"
                  >
                    Mark all read
                  </button>
                }
              />
              {error && (
                <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              <Card className="p-5">
                {items.length === 0 ? (
                  <div className="py-10 text-center">
                    <Bell className="mx-auto h-10 w-10 text-slate-400" />
                    <p className="mt-3 font-medium">No notifications.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {items.map((n) => (
                      <button
                        key={n.id}
                        onClick={async () => {
                          if (!n.is_read) await markNotificationRead(n.id);
                          load();
                        }}
                        className="block w-full rounded-xl border p-4 text-left hover:bg-slate-50"
                      >
                        <p className="font-medium">{n.title}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {n.message}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
