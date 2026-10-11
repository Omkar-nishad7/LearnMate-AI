"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import { fetchMyUser, updateMyUser } from "@/services/users";

function errorMessage(error, fallback) {
  const detail = error?.data?.detail;
  if (typeof detail === "object" && detail) {
    return detail.message || detail.detail || detail.error || fallback;
  }
  return error?.message || detail || fallback;
}

export default function StudentProfilePage() {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({
    full_name: "",
    display_name: "",
    phone: "",
    bio: "",
    organization: "",
    grade_level: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchMyUser()
      .then((value) => {
        if (cancelled) return;
        setUser(value);
        setForm({
          full_name: value.profile?.full_name || "",
          display_name: value.profile?.display_name || "",
          phone: value.profile?.phone || "",
          bio: value.profile?.bio || "",
          organization: value.profile?.organization || "",
          grade_level: value.profile?.grade_level || "",
        });
      })
      .catch((err) => {
        if (!cancelled)
          setError(errorMessage(err, "Unable to load your profile."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setSuccess("");
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const updated = await updateMyUser({
        full_name: form.full_name.trim(),
        display_name: form.display_name.trim() || null,
        phone: form.phone.trim() || null,
        bio: form.bio.trim() || null,
        organization: form.organization.trim() || null,
        grade_level: form.grade_level.trim() || null,
      });
      setUser(updated);
      setForm({
        full_name: updated.profile?.full_name || "",
        display_name: updated.profile?.display_name || "",
        phone: updated.profile?.phone || "",
        bio: updated.profile?.bio || "",
        organization: updated.profile?.organization || "",
        grade_level: updated.profile?.grade_level || "",
      });
      setSuccess("Profile updated successfully.");
    } catch (err) {
      setError(errorMessage(err, "Unable to save your profile."));
    } finally {
      setSaving(false);
    }
  }

  const name = form.display_name || form.full_name || "Student";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <Sidebar role="student" />
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            title="Profile"
            subtitle="Manage your personal information"
            user={user || { full_name: "Student", role: "Student" }}
          />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl space-y-6">
              <PageHeader
                title="My Profile"
                description="View and update your personal information and learning preferences."
              />

              {error ? (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </div>
              ) : null}
              {success ? (
                <div
                  role="status"
                  className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"
                >
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
                          alt="Profile"
                          className="h-24 w-24 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-blue-50 text-3xl font-bold text-blue-700">
                          {name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <h3 className="mt-4 text-xl font-semibold text-slate-900">
                        {name}
                      </h3>
                      <p className="text-sm text-slate-500">
                        {user?.email || ""}
                      </p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
                        Student
                      </p>
                    </div>
                  </Card>

                  <Card className="p-6">
                    <form
                      onSubmit={submit}
                      className="grid gap-5 md:grid-cols-2"
                    >
                      <div>
                        <label
                          htmlFor="student-full-name"
                          className="mb-2 block text-sm font-medium text-slate-700"
                        >
                          Full Name
                        </label>
                        <input
                          id="student-full-name"
                          required
                          minLength={2}
                          maxLength={150}
                          className="input-ui"
                          value={form.full_name}
                          onChange={(e) =>
                            setField("full_name", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="student-display-name"
                          className="mb-2 block text-sm font-medium text-slate-700"
                        >
                          Display Name
                        </label>
                        <input
                          id="student-display-name"
                          maxLength={100}
                          className="input-ui"
                          value={form.display_name}
                          onChange={(e) =>
                            setField("display_name", e.target.value)
                          }
                          placeholder="Name shown around LearnMate"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="student-email"
                          className="mb-2 block text-sm font-medium text-slate-700"
                        >
                          Email
                        </label>
                        <input
                          id="student-email"
                          className="input-ui bg-slate-100"
                          value={user?.email || ""}
                          disabled
                          readOnly
                        />
                        <p className="mt-1 text-xs text-slate-500">
                          Email address cannot be changed here.
                        </p>
                      </div>
                      <div>
                        <label
                          htmlFor="student-phone"
                          className="mb-2 block text-sm font-medium text-slate-700"
                        >
                          Phone
                        </label>
                        <input
                          id="student-phone"
                          type="tel"
                          maxLength={30}
                          className="input-ui"
                          value={form.phone}
                          onChange={(e) => setField("phone", e.target.value)}
                          placeholder="+91…"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="student-organization"
                          className="mb-2 block text-sm font-medium text-slate-700"
                        >
                          College / Institution
                        </label>
                        <input
                          id="student-organization"
                          maxLength={150}
                          className="input-ui"
                          value={form.organization}
                          onChange={(e) =>
                            setField("organization", e.target.value)
                          }
                          placeholder="Your college or institution"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="student-grade-level"
                          className="mb-2 block text-sm font-medium text-slate-700"
                        >
                          Class / Study Level
                        </label>
                        <input
                          id="student-grade-level"
                          maxLength={50}
                          className="input-ui"
                          value={form.grade_level}
                          onChange={(e) =>
                            setField("grade_level", e.target.value)
                          }
                          placeholder="e.g. B.Tech 2nd Year"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label
                          htmlFor="student-bio"
                          className="mb-2 block text-sm font-medium text-slate-700"
                        >
                          Bio
                        </label>
                        <textarea
                          id="student-bio"
                          maxLength={2000}
                          className="input-ui min-h-32"
                          value={form.bio}
                          onChange={(e) => setField("bio", e.target.value)}
                          placeholder="Tell us a little about yourself and what you are learning."
                        />
                      </div>
                      <div className="md:col-span-2 flex justify-end">
                        <button
                          type="submit"
                          disabled={saving}
                          className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
                        >
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
