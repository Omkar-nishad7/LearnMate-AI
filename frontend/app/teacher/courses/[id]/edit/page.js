"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  Clock3,
  Eye,
  FileText,
  Globe2,
  ImagePlus,
  Layers3,
  Save,
  Settings2,
  Sparkles,
  Video,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import { fetchTeacherCourseById, updateCourse } from "@/services/courses";
import { fetchMyUser } from "@/services/users";
import CoursePreviewModal from "@/components/course/CoursePreviewModal";

function errorMessage(error, fallback) {
  const detail = error?.data?.detail;
  if (typeof detail === "object" && detail)
    return detail.message || detail.detail || fallback;
  return error?.message || detail || fallback;
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50";
const labelClass = "mb-2 block text-xs font-semibold text-slate-600";

function parseLineList(value) {
  return String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseFaqList(value) {
  return String(value || "")
    .split("\n")
    .map((line) => {
      const separator = line.indexOf("|");
      if (separator < 0) return null;
      const question = line.slice(0, separator).trim();
      const answer = line.slice(separator + 1).trim();
      return question && answer ? { question, answer } : null;
    })
    .filter(Boolean);
}

function faqText(value) {
  return (Array.isArray(value) ? value : [])
    .map((item) => `${item?.question || ""} | ${item?.answer || ""}`)
    .join("\n");
}

function priceText(cents, currency = "INR", isFree = false) {
  if (isFree || !Number(cents)) return "Free";
  const code = currency === "USD" ? "USD" : "INR";
  return new Intl.NumberFormat(code === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency: code,
    maximumFractionDigits: 2,
  }).format(Number(cents) / 100);
}

export default function EditCoursePage() {
  const { id } = useParams();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [course, setCourse] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    Promise.all([fetchTeacherCourseById(id), fetchMyUser()])
      .then(([data, me]) => {
        if (cancelled) return;
        setCourse(data);
        setUser(me);
        setForm({
          title: data.title || "",
          short_description: data.short_description || "",
          description: data.description || "",
          category: data.category || "",
          difficulty: data.difficulty || "beginner",
          language: data.language || "en",
          thumbnail_url: data.thumbnail_url || "",
          is_free: data.is_free !== false,
          price_cents: data.price_cents || 0,
          price_amount: (Number(data.price_cents || 0) / 100).toFixed(2),
          price_currency: data.price_currency === "USD" ? "USD" : "INR",
          learning_outcomes: (data.learning_outcomes || []).join("\n"),
          skills: (data.skills || []).join("\n"),
          requirements: (data.requirements || []).join("\n"),
          projects: (data.projects || []).join("\n"),
          learning_path: (data.learning_path || []).join("\n"),
          ai_features: (data.ai_features || []).join("\n"),
          included_features: (data.included_features || []).join("\n"),
          faqs: faqText(data.faqs || []),
          duration_minutes: data.duration_minutes || 0,
        });
      })
      .catch((err) => {
        if (!cancelled)
          setError(errorMessage(err, "Unable to load the course."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setSuccess("");
  }

  async function submit(event) {
    event.preventDefault();
    if (!form || saving) return;
    if (!form.is_free && Number(form.price_amount || 0) <= 0) {
      setError(
        "Enter a course price greater than zero, or mark the course as free.",
      );
      setSuccess("");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const { price_amount, ...formData } = form;
      const updated = await updateCourse(id, {
        ...formData,
        learning_outcomes: parseLineList(form.learning_outcomes),
        skills: parseLineList(form.skills),
        requirements: parseLineList(form.requirements),
        projects: parseLineList(form.projects),
        learning_path: parseLineList(form.learning_path),
        ai_features: parseLineList(form.ai_features),
        included_features: parseLineList(form.included_features),
        faqs: parseFaqList(form.faqs),
        price_cents: form.is_free
          ? 0
          : Math.max(0, Math.round(Number(price_amount || 0) * 100)),
        price_currency: form.price_currency === "USD" ? "USD" : "INR",
        duration_minutes: Number(form.duration_minutes || 0) || null,
        thumbnail_url: form.thumbnail_url.trim() || null,
      });
      setCourse(updated || { ...course, ...form });
      setSuccess("Course changes saved successfully.");
    } catch (err) {
      setError(errorMessage(err, "Unable to save the course."));
    } finally {
      setSaving(false);
    }
  }

  const level = form?.difficulty || "beginner";
  const duration = form?.duration_minutes
    ? `${Math.max(1, Math.round(Number(form.duration_minutes) / 60))} hour${Number(form.duration_minutes) >= 120 ? "s" : ""}`
    : "Duration not set";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <Sidebar role="teacher" />
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            title="Edit Course"
            subtitle="Update your course details, modules and settings"
            user={user || { full_name: "Teacher", role: "Teacher" }}
          />
          <main className="flex-1 px-4 py-5 pb-24 sm:px-6 lg:px-7 lg:pb-8">
            <div className="mx-auto max-w-[1500px]">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Link
                    href="/teacher/courses"
                    className="mb-2 inline-flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-indigo-600"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Courses
                  </Link>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                    Edit Course
                  </h1>
                  <p className="mt-1 text-sm text-slate-500">
                    Update your course details, content access and settings.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewOpen(true)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    <Eye className="h-4 w-4" />
                    Preview Student Page
                  </button>
                  <button
                    type="submit"
                    form="edit-course-form"
                    disabled={saving || loading || !form}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              </div>

              {error ? (
                <div
                  role="alert"
                  className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {error}
                </div>
              ) : null}
              {success ? (
                <div
                  role="status"
                  className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
                >
                  <Check className="h-4 w-4" />
                  {success}
                </div>
              ) : null}

              {loading || !form ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
                  Loading course details…
                </div>
              ) : (
                <form
                  id="edit-course-form"
                  onSubmit={submit}
                  className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,.9fr)]"
                >
                  <div className="min-w-0 space-y-4">
                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                            <BookOpen className="h-5 w-5" />
                          </span>
                          <div>
                            <h2 className="font-bold text-slate-900">
                              1. Basic Details
                            </h2>
                            <p className="mt-1 text-xs text-slate-500">
                              Update the essential information about your
                              course.
                            </p>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          {String(course?.status || "Draft").replaceAll(
                            "_",
                            " ",
                          )}
                        </span>
                      </div>
                      <div className="grid gap-5 md:grid-cols-2">
                        <div>
                          <label className={labelClass}>
                            Course Title <span className="text-red-500">*</span>
                          </label>
                          <input
                            required
                            minLength={3}
                            maxLength={200}
                            value={form.title}
                            onChange={(e) => setField("title", e.target.value)}
                            className={inputClass}
                            placeholder="Enter course title"
                          />
                        </div>
                        <div>
                          <label className={labelClass}>
                            Category <span className="text-red-500">*</span>
                          </label>
                          <input
                            required
                            maxLength={100}
                            value={form.category}
                            onChange={(e) =>
                              setField("category", e.target.value)
                            }
                            className={inputClass}
                            placeholder="e.g. Computer Science"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className={labelClass}>
                            Short Description
                          </label>
                          <input
                            maxLength={500}
                            value={form.short_description}
                            onChange={(e) =>
                              setField("short_description", e.target.value)
                            }
                            className={inputClass}
                            placeholder="A short introduction shown on course cards"
                          />
                          <p className="mt-1.5 text-xs text-slate-400">
                            {form.short_description.length}/500 characters
                          </p>
                        </div>
                        <div className="md:col-span-2">
                          <label className={labelClass}>
                            Course Description
                          </label>
                          <textarea
                            rows={5}
                            value={form.description}
                            onChange={(e) =>
                              setField("description", e.target.value)
                            }
                            className={`${inputClass} resize-y leading-6`}
                            placeholder="Describe what students will learn in this course…"
                          />
                        </div>
                        <div>
                          <label className={labelClass}>
                            Course Level <span className="text-red-500">*</span>
                          </label>
                          <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
                            {["beginner", "intermediate", "advanced"].map(
                              (item) => (
                                <button
                                  key={item}
                                  type="button"
                                  onClick={() => setField("difficulty", item)}
                                  className={`rounded-lg px-2 py-2 text-xs font-semibold capitalize transition ${form.difficulty === item ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-white"}`}
                                >
                                  {item}
                                </button>
                              ),
                            )}
                          </div>
                        </div>
                        <div>
                          <label className={labelClass}>
                            Language <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <select
                              value={form.language}
                              onChange={(e) =>
                                setField("language", e.target.value)
                              }
                              className={`${inputClass} appearance-none pr-9`}
                            >
                              <option value="en">English</option>
                              <option value="hi">Hindi</option>
                              <option value="es">Spanish</option>
                              <option value="fr">French</option>
                              <option value="other">Other</option>
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-400" />
                          </div>
                        </div>
                        <div>
                          <label className={labelClass}>
                            Duration (minutes)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100000"
                            value={form.duration_minutes}
                            onChange={(e) =>
                              setField("duration_minutes", e.target.value)
                            }
                            className={inputClass}
                            placeholder="e.g. 480"
                          />
                        </div>
                        <div>
                          <label className={labelClass}>
                            Thumbnail / Cover Image URL
                          </label>
                          <div className="relative">
                            <ImagePlus className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                            <input
                              maxLength={500}
                              value={form.thumbnail_url}
                              onChange={(e) =>
                                setField("thumbnail_url", e.target.value)
                              }
                              className={`${inputClass} pl-9`}
                              placeholder="https://…"
                            />
                          </div>
                          <p className="mt-1.5 text-xs text-slate-400">
                            Paste a publicly accessible image URL.
                          </p>
                        </div>
                      </div>
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                      <div className="mb-5 flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                          <Sparkles className="h-5 w-5" />
                        </span>
                        <div>
                          <h2 className="font-bold text-slate-900">
                            Student-facing details
                          </h2>
                          <p className="mt-1 text-xs text-slate-500">
                            These editable details appear on the student course
                            page. Use one item per line; FAQ lines use Question
                            | Answer.
                          </p>
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        {[
                          [
                            "learning_outcomes",
                            "What students will learn",
                            "Add one learning outcome per line",
                          ],
                          [
                            "skills",
                            "Skills you’ll gain",
                            "Python\nPrompt engineering\nRAG",
                          ],
                          [
                            "requirements",
                            "Requirements",
                            "Prerequisites and tools students need",
                          ],
                          [
                            "projects",
                            "Projects students will build",
                            "AI chatbot\nSearch assistant",
                          ],
                          [
                            "learning_path",
                            "Learning path",
                            "Foundations\nCore concepts\nHands-on project",
                          ],
                          [
                            "ai_features",
                            "AI learning features",
                            "AI tutor support\nPractice quiz generation",
                          ],
                          [
                            "included_features",
                            "What’s included",
                            "Course lessons\nPractice resources\nProject files",
                          ],
                        ].map(([key, label, placeholder]) => (
                          <div key={key}>
                            <label className={labelClass}>{label}</label>
                            <textarea
                              rows={4}
                              value={form[key] || ""}
                              onChange={(e) => setField(key, e.target.value)}
                              className={`${inputClass} resize-y leading-6`}
                              placeholder={placeholder}
                            />
                          </div>
                        ))}
                        <div className="md:col-span-2">
                          <label className={labelClass}>
                            Frequently asked questions
                          </label>
                          <textarea
                            rows={3}
                            value={form.faqs || ""}
                            onChange={(e) => setField("faqs", e.target.value)}
                            className={`${inputClass} resize-y leading-6`}
                            placeholder="Do I need prior experience? | No, the course starts with the basics."
                          />
                          <p className="mt-1.5 text-xs text-slate-400">
                            One FAQ per line in Question | Answer format.
                          </p>
                        </div>
                      </div>
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                      <div className="mb-5 flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                          <Layers3 className="h-5 w-5" />
                        </span>
                        <div>
                          <h2 className="font-bold text-slate-900">
                            2. Course Content
                          </h2>
                          <p className="mt-1 text-xs text-slate-500">
                            Manage modules, lessons and attached learning
                            resources.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex gap-3">
                          <span className="mt-0.5 text-indigo-600">
                            <FileText className="h-5 w-5" />
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              Modules, lessons and resources
                            </p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              Create and reorder modules, add or edit lessons,
                              upload or import lesson videos, and attach
                              downloadable PDFs, documents, notes, worksheets,
                              or images to the whole course or a specific
                              lesson. Course materials become available to
                              enrolled students.
                            </p>
                          </div>
                        </div>
                        <Link
                          href={`/teacher/courses/${id}`}
                          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
                        >
                          <Layers3 className="h-4 w-4" />
                          Manage Modules, Lessons & Resources
                        </Link>
                      </div>
                    </section>
                  </div>

                  <aside className="space-y-4">
                    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="mb-4 flex items-center justify-between">
                        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                          <Eye className="h-4 w-4 text-indigo-600" />
                          Course Preview
                        </h2>
                        <Link
                          href={`/teacher/courses/${id}`}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                        >
                          View Live
                        </Link>
                      </div>
                      <div className="overflow-hidden rounded-xl bg-slate-950">
                        {form.thumbnail_url ? (
                          <div className="relative h-32 bg-slate-900">
                            <img
                              src={form.thumbnail_url}
                              alt="Course cover preview"
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-950/45 to-transparent" />
                            <div className="absolute inset-0 flex items-center p-4">
                              <div className="max-w-[85%]">
                                <p className="line-clamp-2 text-base font-bold text-white">
                                  {form.title || "Course title"}
                                </p>
                                <p className="mt-1 line-clamp-2 text-xs text-slate-200">
                                  {form.short_description ||
                                    "Build your skills with this course."}
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex min-h-32 items-center gap-4 bg-gradient-to-br from-slate-950 to-indigo-950 p-5">
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
                              <BookOpen className="h-6 w-6" />
                            </span>
                            <div>
                              <p className="line-clamp-2 text-base font-bold text-white">
                                {form.title || "Course title"}
                              </p>
                              <p className="mt-1 line-clamp-2 text-xs text-slate-300">
                                {form.short_description ||
                                  "Build your skills with this course."}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1.5 capitalize">
                          <Sparkles className="h-4 w-4" />
                          {level}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3 className="h-4 w-4" />
                          {duration}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Globe2 className="h-4 w-4" />
                          {form.language === "en"
                            ? "English"
                            : form.language === "hi"
                              ? "Hindi"
                              : form.language}
                        </span>
                      </div>
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
                        <Sparkles className="h-4 w-4 text-indigo-600" />
                        What students will learn
                      </h2>
                      {parseLineList(form.learning_outcomes).length ? (
                        <ul className="space-y-2">
                          {parseLineList(form.learning_outcomes)
                            .slice(0, 4)
                            .map((item, index) => (
                              <li
                                key={`${item}-${index}`}
                                className="flex gap-2 text-sm leading-5 text-slate-600"
                              >
                                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                                {item}
                              </li>
                            ))}
                        </ul>
                      ) : (
                        <p className="text-sm leading-6 text-slate-600">
                          {form.description ||
                            form.short_description ||
                            "Add learning outcomes in the editor to preview them here."}
                        </p>
                      )}
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
                        <Settings2 className="h-4 w-4 text-indigo-600" />
                        Additional Settings
                      </h2>
                      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-200 p-3">
                        <span>
                          <span className="block text-sm font-semibold text-slate-800">
                            Course pricing
                          </span>
                          <span className="mt-1 block text-xs text-slate-500">
                            {form.is_free
                              ? "Free for students"
                              : `Price: ${priceText(Math.round(Number(form.price_amount || 0) * 100), form.price_currency)}`}
                          </span>
                        </span>
                        <input
                          type="checkbox"
                          checked={form.is_free}
                          onChange={(e) =>
                            setField("is_free", e.target.checked)
                          }
                          className="h-4 w-4 accent-indigo-600"
                        />
                      </label>
                      <div className="mt-3">
                        <label className={labelClass}>Currency</label>
                        <select
                          value={form.price_currency || "INR"}
                          onChange={(e) =>
                            setField("price_currency", e.target.value)
                          }
                          className={inputClass}
                        >
                          <option value="INR">INR — Indian Rupee (₹)</option>
                          <option value="USD">USD — US Dollar ($)</option>
                        </select>
                      </div>
                      {!form.is_free ? (
                        <div className="mt-3">
                          <label className={labelClass}>
                            Course price (
                            {form.price_currency === "USD" ? "$" : "₹"})
                          </label>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={form.price_amount}
                            onChange={(e) =>
                              setField("price_amount", e.target.value)
                            }
                            className={inputClass}
                          />
                          <p className="mt-1 text-xs text-slate-500">
                            Shown to students. Buy Now is currently demo
                            enrollment only.
                          </p>
                        </div>
                      ) : null}
                      <div className="mt-3 rounded-xl border border-slate-200 p-3">
                        <p className="text-xs font-semibold text-slate-700">
                          Course visibility
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Publishing and archiving are managed from All Courses
                          so existing status actions stay consistent.
                        </p>
                        <Link
                          href="/teacher/courses"
                          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600"
                        >
                          Manage course status{" "}
                          <ArrowLeft className="h-3 w-3 rotate-180" />
                        </Link>
                      </div>
                    </section>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                      >
                        <Save className="h-4 w-4" />
                        {saving ? "Saving…" : "Save Changes"}
                      </button>
                      <Link
                        href={`/teacher/courses/${id}`}
                        className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Cancel
                      </Link>
                    </div>
                  </aside>
                </form>
              )}
            </div>
          </main>
        </div>
      </div>
      {previewOpen && form ? (
        <CoursePreviewModal
          course={{
            ...form,
            price_cents: Math.round(Number(form.price_amount || 0) * 100),
            learning_outcomes: parseLineList(form.learning_outcomes),
            skills: parseLineList(form.skills),
            requirements: parseLineList(form.requirements),
            projects: parseLineList(form.projects),
            learning_path: parseLineList(form.learning_path),
            ai_features: parseLineList(form.ai_features),
            included_features: parseLineList(form.included_features),
            faqs: parseFaqList(form.faqs),
          }}
          modules={course?.modules || []}
          instructor={user}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </div>
  );
}
