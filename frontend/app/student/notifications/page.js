"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  ChevronRight,
  Clock3,
  ExternalLink,
  Filter,
  Inbox,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import {
  deleteNotification,
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/services/notifications";

const TYPE_LABELS = {
  INFO: "Information",
  ALERT: "Alert",
  REMINDER: "Reminder",
  ASSIGNMENT: "Assignment",
  QUIZ: "Quiz",
  MESSAGE: "Message",
  AI: "AI Update",
};

const TYPE_STYLES = {
  INFO: "bg-slate-100 text-slate-700",
  ALERT: "bg-red-50 text-red-700",
  REMINDER: "bg-amber-50 text-amber-700",
  ASSIGNMENT: "bg-blue-50 text-blue-700",
  QUIZ: "bg-emerald-50 text-emerald-700",
  MESSAGE: "bg-violet-50 text-violet-700",
  AI: "bg-indigo-50 text-indigo-700",
};

function formatNotificationTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const diff = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff >= 0 && diff < minute) return "Just now";
  if (diff >= 0 && diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff >= 0 && diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff >= 0 && diff < 7 * day) return `${Math.floor(diff / day)}d ago`;

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [filter, setFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const [list, count] = await Promise.all([
        fetchNotifications(),
        fetchUnreadCount(),
      ]);
      setItems(list?.items || list || []);
      setUnread(Number(count?.unread || 0));
    } catch (e) {
      setError(e?.message || "Unable to load notifications.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const types = useMemo(() => {
    const values = items.map((item) => item.type).filter(Boolean);
    return [...new Set(values)];
  }, [items]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return items.filter((item) => {
      if (filter === "unread" && item.is_read) return false;
      if (filter === "read" && !item.is_read) return false;
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      if (!normalized) return true;

      return [item.title, item.body, item.message, item.type]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [filter, items, query, typeFilter]);

  async function handleMarkRead(id) {
    setBusyId(id);
    try {
      await markNotificationRead(id);
      setItems((current) =>
        current.map((item) =>
          item.id === id ? { ...item, is_read: true } : item,
        ),
      );
      setUnread((current) => Math.max(0, current - 1));
    } catch (e) {
      setError(e?.message || "Unable to update the notification.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id) {
    if (
      !window.confirm("Delete this notification? This action cannot be undone.")
    ) {
      return;
    }

    const target = items.find((item) => item.id === id);
    setBusyId(id);
    try {
      await deleteNotification(id);
      setItems((current) => current.filter((item) => item.id !== id));
      if (target && !target.is_read) {
        setUnread((current) => Math.max(0, current - 1));
      }
    } catch (e) {
      setError(e?.message || "Unable to delete the notification.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleMarkAllRead() {
    if (!unread) return;
    setBusyId("all");
    try {
      await markAllNotificationsRead();
      setItems((current) =>
        current.map((item) => ({ ...item, is_read: true })),
      );
      setUnread(0);
    } catch (e) {
      setError(e?.message || "Unable to mark notifications as read.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleOpen(item) {
    if (!item.link_url) return;
    if (!item.is_read) await handleMarkRead(item.id);
    window.location.assign(item.link_url);
  }

  const tabButton = (value, label, count) => (
    <button
      type="button"
      onClick={() => setFilter(value)}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
        filter === value
          ? "bg-blue-50 text-blue-700"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      {label}
      {typeof count === "number" && (
        <span
          className={`ml-2 rounded-full px-1.5 py-0.5 text-xs ${
            filter === value
              ? "bg-blue-100 text-blue-700"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <Sidebar role="student" />
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            title="Notifications"
            subtitle="Stay updated with your LearnMate activity"
            user={{ full_name: "Student", role: "Student" }}
          />

          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl space-y-6">
              <PageHeader
                title="Notifications"
                description="Assignments, quizzes, reminders, messages and other account updates in one place."
                action={
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => load(true)}
                      disabled={refreshing || loading}
                      className="btn-secondary"
                    >
                      {refreshing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      Refresh
                    </button>
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      disabled={!unread || busyId === "all"}
                      className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busyId === "all" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCheck className="mr-2 h-4 w-4" />
                      )}
                      Mark all read
                    </button>
                  </div>
                }
              />

              {error && (
                <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <span>{error}</span>
                  <button
                    type="button"
                    onClick={() => setError("")}
                    aria-label="Dismiss error"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              <Card className="overflow-hidden p-0">
                <div className="border-b border-slate-200 bg-white p-4 sm:p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                        <Bell className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-slate-900">
                          Your activity
                        </h2>
                        <p className="text-sm text-slate-500">
                          {unread
                            ? `${unread} unread notification${unread === 1 ? "" : "s"}`
                            : "You're all caught up"}
                        </p>
                      </div>
                    </div>

                    <div className="relative w-full lg:max-w-sm">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search notifications..."
                        className="input-ui w-full pl-9"
                        aria-label="Search notifications"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-1 rounded-xl bg-slate-50 p-1">
                    {tabButton("all", "All", items.length)}
                    {tabButton("unread", "Unread", unread)}
                    {tabButton(
                      "read",
                      "Read",
                      Math.max(0, items.length - unread),
                    )}
                  </div>

                  {types.length > 0 && (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <div className="mr-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                        <Filter className="h-3.5 w-3.5" />
                        Type
                      </div>
                      <button
                        type="button"
                        onClick={() => setTypeFilter("all")}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                          typeFilter === "all"
                            ? "border-blue-200 bg-blue-50 text-blue-700"
                            : "border-slate-200 bg-white text-slate-600"
                        }`}
                      >
                        All types
                      </button>
                      {types.map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setTypeFilter(type)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                            typeFilter === type
                              ? "border-blue-200 bg-blue-50 text-blue-700"
                              : "border-slate-200 bg-white text-slate-600"
                          }`}
                        >
                          {TYPE_LABELS[type] || type}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-slate-50/60 p-4 sm:p-5">
                  {loading ? (
                    <div className="flex items-center justify-center py-16 text-sm text-slate-500">
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Loading notifications...
                    </div>
                  ) : filteredItems.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                        <Inbox className="h-7 w-7" />
                      </div>
                      <h3 className="mt-4 font-semibold text-slate-900">
                        {items.length
                          ? "No matching notifications"
                          : "No notifications yet"}
                      </h3>
                      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                        {items.length
                          ? "Try another search or filter to find the notification you need."
                          : "New assignments, quiz results and other account updates will appear here."}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredItems.map((item) => {
                        const body =
                          item.body ||
                          item.message ||
                          "No additional details available.";
                        const type = item.type || "INFO";
                        const busy = busyId === item.id;

                        return (
                          <article
                            key={item.id}
                            className={`rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md sm:p-5 ${
                              item.is_read
                                ? "border-slate-200"
                                : "border-blue-200 ring-1 ring-blue-50"
                            }`}
                          >
                            <div className="flex gap-4">
                              <div
                                className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                                  TYPE_STYLES[type] || TYPE_STYLES.INFO
                                }`}
                              >
                                <Bell className="h-5 w-5" />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <h3 className="font-semibold text-slate-900">
                                        {item.title}
                                      </h3>
                                      {!item.is_read && (
                                        <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                                          New
                                        </span>
                                      )}
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                      <span
                                        className={`rounded-full px-2 py-1 font-medium ${TYPE_STYLES[type] || TYPE_STYLES.INFO}`}
                                      >
                                        {TYPE_LABELS[type] || type}
                                      </span>
                                      <span className="inline-flex items-center gap-1">
                                        <Clock3 className="h-3.5 w-3.5" />
                                        {formatNotificationTime(
                                          item.created_at,
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">
                                  {body}
                                </p>

                                <div className="mt-4 flex flex-wrap items-center gap-2">
                                  {item.link_url && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpen(item)}
                                      disabled={busy}
                                      className="btn-primary"
                                    >
                                      <ExternalLink className="mr-2 h-4 w-4" />
                                      Open
                                      <ChevronRight className="ml-1 h-4 w-4" />
                                    </button>
                                  )}
                                  {!item.is_read && (
                                    <button
                                      type="button"
                                      onClick={() => handleMarkRead(item.id)}
                                      disabled={busy}
                                      className="btn-secondary"
                                    >
                                      {busy ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      ) : (
                                        <Check className="mr-2 h-4 w-4" />
                                      )}
                                      Mark as read
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(item.id)}
                                    disabled={busy}
                                    className="btn-secondary text-red-600 hover:border-red-200 hover:bg-red-50"
                                  >
                                    {busy ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="mr-2 h-4 w-4" />
                                    )}
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
