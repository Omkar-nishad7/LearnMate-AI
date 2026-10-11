"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import { fetchMyUser, updateMyUser } from "@/services/users";
import { fetchTeacherYouTubeChannel } from "@/services/search";

function errorMessage(error, fallback) {
  const detail = error?.data?.detail;
  if (typeof detail === "object" && detail)
    return detail.message || detail.detail || fallback;
  return error?.message || detail || fallback;
}

export default function TeacherProfilePage() {
  const [user, setUser] = useState(null);
  const [channel, setChannel] = useState(null);
  const [form, setForm] = useState({
    full_name: "",
    display_name: "",
    bio: "",
    organization: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    Promise.allSettled([fetchMyUser(), fetchTeacherYouTubeChannel()]).then(
      ([userResult, channelResult]) => {
        if (userResult.status === "fulfilled") {
          const value = userResult.value;
          setUser(value);
          setForm({
            full_name: value.profile?.full_name || "",
            display_name: value.profile?.display_name || "",
            bio: value.profile?.bio || "",
            organization: value.profile?.organization || "",
          });
        } else
          setError(
            errorMessage(userResult.reason, "Unable to load your profile."),
          );
        if (channelResult.status === "fulfilled")
          setChannel(channelResult.value);
        setLoading(false);
      },
    );
  }, []);

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const updated = await updateMyUser(form);
      setUser(updated);
      setSuccess("Profile updated successfully.");
    } catch (err) {
      setError(errorMessage(err, "Unable to save your profile."));
    } finally {
      setSaving(false);
    }
  }

  const name =
    user?.profile?.display_name || user?.profile?.full_name || "Teacher";
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <Sidebar role="teacher" />
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            title="Profile"
            subtitle="Manage your public teaching profile"
            user={user || { full_name: "Teacher", role: "Teacher" }}
          />
          <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl space-y-6">
              <PageHeader
                title="Teacher Profile"
                description="These details are used to identify you to students. Your published courses and linked YouTube channel can be discovered from your public teacher profile."
              />
              {error ? (
                <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}
              {success ? (
                <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
                  {success}
                </div>
              ) : null}
              {loading ? (
                <Card className="p-10 text-center text-sm text-slate-500">
                  Loading profile…
                </Card>
              ) : (
                <section className="grid gap-6 lg:grid-cols-[1fr_2fr]">
                  <Card className="p-6">
                    <div className="flex flex-col items-center text-center">
                      {user?.profile?.avatar_url ? (
                        <img
                          src={user.profile.avatar_url}
                          alt=""
                          className="h-24 w-24 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-blue-50 text-3xl font-bold text-blue-700">
                          {name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <h2 className="mt-4 text-xl font-semibold text-slate-900">
                        {name}
                      </h2>
                      <p className="text-sm text-slate-500">Teacher</p>
                      {user?.profile?.organization ? (
                        <p className="mt-2 text-sm text-slate-500">
                          {user.profile.organization}
                        </p>
                      ) : null}
                      {channel ? (
                        <Link
                          href="/teacher/youtube-channel"
                          className="btn-secondary mt-5 w-full"
                        >
                          Manage YouTube Channel
                        </Link>
                      ) : (
                        <Link
                          href="/teacher/youtube-channel"
                          className="btn-primary mt-5 w-full"
                        >
                          Add YouTube Channel
                        </Link>
                      )}
                    </div>
                  </Card>
                  <Card className="p-6">
                    <form
                      onSubmit={submit}
                      className="grid gap-5 md:grid-cols-2"
                    >
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          Full Name
                        </label>
                        <input
                          required
                          className="input-ui"
                          value={form.full_name}
                          onChange={(e) =>
                            setField("full_name", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          Display Name
                        </label>
                        <input
                          className="input-ui"
                          value={form.display_name}
                          onChange={(e) =>
                            setField("display_name", e.target.value)
                          }
                          placeholder="How students should see you"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          Email
                        </label>
                        <input
                          className="input-ui"
                          value={user?.email || ""}
                          disabled
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          Organization / Institution
                        </label>
                        <input
                          className="input-ui"
                          value={form.organization}
                          onChange={(e) =>
                            setField("organization", e.target.value)
                          }
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          Bio
                        </label>
                        <textarea
                          className="input-ui min-h-32"
                          value={form.bio}
                          onChange={(e) => setField("bio", e.target.value)}
                          placeholder="Tell students about your teaching background and subjects."
                        />
                      </div>
                      <div className="md:col-span-2 flex justify-end">
                        <button disabled={saving} className="btn-primary">
                          {saving ? "Saving…" : "Save Changes"}
                        </button>
                      </div>
                    </form>
                  </Card>
                </section>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
