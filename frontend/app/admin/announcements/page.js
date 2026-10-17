"use client";

import { useEffect, useState } from "react";
import { BellRing, Megaphone, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { AdminError, AdminPanel, PageHeader } from "@/components/admin/AdminUI";
import { createAdminAnnouncement, fetchAdminUsers } from "@/services/admin";

const initial = {
  title: "",
  body: "",
  audience: "ALL",
  target_user_id: "",
  link_url: "",
};
export default function AdminAnnouncementsPage() {
  const [form, setForm] = useState(initial);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  useEffect(() => {
    if (form.audience !== "USER") return;
    let active = true;
    setLoadingUsers(true);
    fetchAdminUsers({ page_size: 100 })
      .then((data) => {
        if (active) setUsers(data.items || []);
      })
      .catch(() => {
        if (active) setUsers([]);
      })
      .finally(() => {
        if (active) setLoadingUsers(false);
      });
    return () => {
      active = false;
    };
  }, [form.audience]);
  function change(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }
  async function submit(event) {
    event.preventDefault();
    setSending(true);
    setError("");
    setResult(null);
    try {
      const payload = {
        title: form.title.trim(),
        body: form.body.trim(),
        audience: form.audience,
        link_url: form.link_url.trim() || null,
      };
      if (form.audience === "USER")
        payload.target_user_id = Number(form.target_user_id);
      const response = await createAdminAnnouncement(payload);
      setResult(response);
      toast.success(
        `Announcement sent to ${response.recipient_count} account(s)`,
      );
      setForm(initial);
    } catch (err) {
      setError(err?.message || "Announcement could not be sent.");
      toast.error(err?.message || "Announcement could not be sent.");
    } finally {
      setSending(false);
    }
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements & notifications"
        description="Send in-app platform announcements to everyone, a role group, or one specific account. Email and push delivery are not configured by this endpoint."
      />
      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <AdminPanel
          title="Compose announcement"
          description="Recipients will see the announcement in their LearnMate notification center."
        >
          {error ? (
            <div className="mb-4">
              <AdminError message={error} />
            </div>
          ) : null}
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Title
              </label>
              <input
                name="title"
                value={form.title}
                onChange={change}
                required
                minLength={3}
                maxLength={300}
                placeholder="e.g. Scheduled platform maintenance"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Message
              </label>
              <textarea
                name="body"
                value={form.body}
                onChange={change}
                required
                minLength={1}
                maxLength={10000}
                rows={6}
                placeholder="Write the announcement details…"
                className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm leading-6 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
              />
              <p className="mt-1 text-right text-[10px] text-slate-400">
                {form.body.length}/10,000
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Audience
                </label>
                <select
                  name="audience"
                  value={form.audience}
                  onChange={change}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-blue-300"
                >
                  <option value="ALL">Everyone</option>
                  <option value="STUDENT">Students</option>
                  <option value="TEACHER">Teachers</option>
                  <option value="USER">Specific user</option>
                </select>
              </div>
              {form.audience === "USER" ? (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Recipient
                  </label>
                  <select
                    required
                    name="target_user_id"
                    value={form.target_user_id}
                    onChange={change}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-blue-300"
                  >
                    <option value="">
                      {loadingUsers ? "Loading users…" : "Choose a user"}
                    </option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name || u.email} — {u.email}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Optional in-app link
              </label>
              <input
                name="link_url"
                value={form.link_url}
                onChange={change}
                maxLength={500}
                placeholder="/student/courses or https://…"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
              />
            </div>
            <button
              type="submit"
              disabled={
                sending || (form.audience === "USER" && !form.target_user_id)
              }
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={16} />
              {sending ? "Sending…" : "Send in-app announcement"}
            </button>
          </form>
        </AdminPanel>
        <div className="space-y-5">
          <AdminPanel
            title="Delivery scope"
            description="Supported by the current notification model"
          >
            <div className="space-y-3">
              {[
                {
                  icon: Users,
                  title: "Everyone",
                  body: "All non-deleted user accounts",
                },
                {
                  icon: Users,
                  title: "Role group",
                  body: "All students or all teachers",
                },
                {
                  icon: BellRing,
                  title: "Specific user",
                  body: "A chosen account from the current user directory",
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="flex gap-3 rounded-xl border border-slate-200 p-3"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <Icon size={18} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {item.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{item.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </AdminPanel>
          <AdminPanel
            title="Previous send result"
            description="Displayed only for the latest action in this session"
          >
            {result ? (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                  <BellRing size={17} /> Announcement created
                </div>
                <p className="mt-2 text-3xl font-bold text-emerald-950">
                  {result.recipient_count}
                </p>
                <p className="text-xs text-emerald-800">
                  Recipient notification records created
                </p>
                <p className="mt-2 text-[11px] text-emerald-700">
                  Audience: {result.audience}
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center">
                <Megaphone size={22} className="mx-auto text-slate-300" />
                <p className="mt-2 text-sm font-semibold text-slate-700">
                  No announcement sent in this session
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  The send result will appear here after a successful request.
                </p>
              </div>
            )}
          </AdminPanel>
        </div>
      </div>
    </div>
  );
}
