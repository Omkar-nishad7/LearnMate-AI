"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  Folder,
  Globe2,
  ImagePlus,
  Layers3,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Video,
  X,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import {
  createCourse,
  createModule,
  createLesson,
  publishCourse,
} from "@/services/courses";
import { fetchMyUser } from "@/services/users";
import CoursePreviewModal from "@/components/course/CoursePreviewModal";

const STEPS = [
  "Basic Details",
  "Course Content",
  "Settings",
  "Review & Publish",
];
const CATEGORIES = [
  "Computer Science",
  "Programming",
  "Data Science",
  "Artificial Intelligence",
  "Web Development",
  "Mathematics",
  "Other",
];
const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100";

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

function errorMessage(error, fallback) {
  if (error?.status === 403)
    return "Teacher access denied. Sign in with your teacher account and try again.";
  const detail = error?.data?.detail;
  if (typeof detail === "object" && detail)
    return detail.message || detail.detail || fallback;
  return (typeof detail === "string" && detail) || error?.message || fallback;
}

function Field({ label, required, hint, children }) {
  return (
    <div className="min-w-0">
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </label>
      {children}
      {hint ? <p className="mt-1.5 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export default function NewCoursePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    short_description: "",
    description: "",
    category: "Computer Science",
    difficulty: "beginner",
    language: "en",
    thumbnail_url: "",
    is_free: true,
    price_amount: "",
    price_currency: "INR",
    learning_outcomes: "",
    skills: "",
    requirements: "",
    projects: "",
    learning_path: "",
    ai_features: "",
    included_features: "",
    faqs: "",
    duration_minutes: 0,
  });
  const [modules, setModules] = useState([{ id: 1, title: "", lessons: [""] }]);
  const [publishAfterCreate, setPublishAfterCreate] = useState(true);
  const [visibility, setVisibility] = useState("public");

  useEffect(() => {
    fetchMyUser()
      .then(setUser)
      .catch(() => {});
  }, []);
  const updateField = (name, value) =>
    setForm((current) => ({ ...current, [name]: value }));
  const lessonCount = useMemo(
    () =>
      modules.reduce(
        (sum, module) => sum + module.lessons.filter((x) => x.trim()).length,
        0,
      ),
    [modules],
  );
  const durationLabel = form.duration_minutes
    ? `${Math.max(1, Math.round(Number(form.duration_minutes) / 60))} hour${Number(form.duration_minutes) >= 120 ? "s" : ""}`
    : "Set duration";
  const levelLabel =
    form.difficulty.charAt(0).toUpperCase() + form.difficulty.slice(1);

  function updateModule(moduleId, value) {
    setModules((current) =>
      current.map((module) =>
        module.id === moduleId ? { ...module, title: value } : module,
      ),
    );
  }
  function addModule() {
    setModules((current) => [
      ...current,
      { id: Date.now(), title: "", lessons: [""] },
    ]);
  }
  function removeModule(moduleId) {
    setModules((current) =>
      current.length > 1
        ? current.filter((module) => module.id !== moduleId)
        : [{ id: Date.now(), title: "", lessons: [""] }],
    );
  }
  function updateLesson(moduleId, lessonIndex, value) {
    setModules((current) =>
      current.map((module) =>
        module.id === moduleId
          ? {
              ...module,
              lessons: module.lessons.map((lesson, index) =>
                index === lessonIndex ? value : lesson,
              ),
            }
          : module,
      ),
    );
  }
  function addLesson(moduleId) {
    setModules((current) =>
      current.map((module) =>
        module.id === moduleId
          ? { ...module, lessons: [...module.lessons, ""] }
          : module,
      ),
    );
  }
  function removeLesson(moduleId, lessonIndex) {
    setModules((current) =>
      current.map((module) =>
        module.id === moduleId
          ? {
              ...module,
              lessons:
                module.lessons.length > 1
                  ? module.lessons.filter((_, index) => index !== lessonIndex)
                  : [""],
            }
          : module,
      ),
    );
  }

  function nextStep() {
    setError("");
    if (step === 0) {
      if (form.title.trim().length < 3)
        return setError("Enter a course title with at least 3 characters.");
      if (!form.category.trim()) return setError("Choose a course category.");
      if (!form.description.trim())
        return setError(
          "Add a course description so students know what they will learn.",
        );
    }
    if (
      step === 1 &&
      modules.some(
        (module) =>
          !module.title.trim() &&
          module.lessons.some((lesson) => lesson.trim()),
      )
    ) {
      return setError("Give each module a title before adding lessons.");
    }
    setStep((current) => Math.min(STEPS.length - 1, current + 1));
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (!form.is_free && Number(form.price_amount || 0) <= 0) {
      setStep(2);
      setError(
        "Enter a course price greater than zero, or choose Free course.",
      );
      return;
    }
    setBusy(true);
    setError("");
    let createdCourse = null;
    try {
      const { price_amount, ...formData } = form;
      createdCourse = await createCourse({
        ...formData,
        learning_outcomes: parseLineList(form.learning_outcomes),
        skills: parseLineList(form.skills),
        requirements: parseLineList(form.requirements),
        projects: parseLineList(form.projects),
        learning_path: parseLineList(form.learning_path),
        ai_features: parseLineList(form.ai_features),
        included_features: parseLineList(form.included_features),
        faqs: parseFaqList(form.faqs),
        title: form.title.trim(),
        short_description: form.short_description.trim() || null,
        description: form.description.trim(),
        category: form.category.trim(),
        language: form.language.trim() || "en",
        thumbnail_url: form.thumbnail_url.trim() || null,
        price_cents: form.is_free
          ? 0
          : Math.max(0, Math.round(Number(price_amount || 0) * 100)),
        duration_minutes:
          Math.max(0, Number(form.duration_minutes || 0)) || null,
      });
      for (const [moduleIndex, module] of modules.entries()) {
        const title = module.title.trim();
        const lessons = module.lessons
          .map((value) => value.trim())
          .filter(Boolean);
        if (!title) continue;
        const createdModule = await createModule(createdCourse.id, {
          title,
          order_index: moduleIndex,
        });
        for (const [lessonIndex, lessonTitle] of lessons.entries()) {
          await createLesson(createdModule.id, {
            title: lessonTitle,
            order_index: lessonIndex,
          });
        }
      }
      if (publishAfterCreate) await publishCourse(createdCourse.id);
      router.replace(`/teacher/courses/${createdCourse.id}`);
      router.refresh();
    } catch (err) {
      if (createdCourse?.id) {
        setError(
          `${errorMessage(err, "Some course content could not be saved.")} The course was created; opening it so you can finish editing without losing it.`,
        );
        window.setTimeout(
          () => router.replace(`/teacher/courses/${createdCourse.id}`),
          1600,
        );
      } else {
        setError(
          errorMessage(
            err,
            "Unable to create the course. Please check the details and try again.",
          ),
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f7fc]">
      <div className="flex min-h-screen">
        <Sidebar role="teacher" />
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            title="Create New Course"
            subtitle="Build a complete learning experience with AI-powered tools"
            user={user || { full_name: "Teacher", role: "Teacher" }}
          />
          <main className="flex-1 px-4 py-5 pb-28 sm:px-6 lg:px-8 lg:pb-8">
            <div className="mx-auto max-w-[1500px]">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                    Create New Course
                  </h1>
                  <p className="mt-1 text-sm text-slate-500">
                    Build a complete learning experience with modules, lessons,
                    and resources.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewOpen(true)}
                    className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50"
                  >
                    <Eye className="h-4 w-4" /> Preview student page
                  </button>
                  <Link
                    href="/teacher/courses"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Courses
                  </Link>
                </div>
              </div>

              {error ? (
                <div
                  role="alert"
                  className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                >
                  {error}
                </div>
              ) : null}

              <form onSubmit={submit}>
                <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.75fr)_minmax(320px,1fr)]">
                  <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="grid grid-cols-2 border-b border-slate-100 sm:grid-cols-4">
                      {STEPS.map((label, index) => (
                        <button
                          type="button"
                          key={label}
                          onClick={() => {
                            if (index <= step) {
                              setStep(index);
                              setError("");
                            }
                          }}
                          className={`relative flex min-h-[68px] items-center justify-center gap-2 px-2 text-xs font-semibold transition sm:text-sm ${step === index ? "text-indigo-700" : index < step ? "text-slate-700" : "text-slate-400"}`}
                        >
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${index < step ? "bg-emerald-100 text-emerald-700" : step === index ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" : "bg-slate-100 text-slate-500"}`}
                          >
                            {index < step ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              index + 1
                            )}
                          </span>
                          <span>{label}</span>
                          {step === index ? (
                            <span className="absolute inset-x-0 bottom-0 h-0.5 bg-indigo-600" />
                          ) : null}
                        </button>
                      ))}
                    </div>

                    <div className="p-5 sm:p-7">
                      {step === 0 ? (
                        <div className="space-y-6">
                          <div className="flex items-start gap-3">
                            <span className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600">
                              <BookOpen className="h-5 w-5" />
                            </span>
                            <div>
                              <h2 className="font-bold text-slate-900">
                                1. Basic Details
                              </h2>
                              <p className="mt-1 text-sm text-slate-500">
                                Provide the essential information about your
                                course.
                              </p>
                            </div>
                          </div>
                          <div className="grid gap-5 sm:grid-cols-2">
                            <Field label="Course Title" required>
                              <input
                                className={inputClass}
                                required
                                minLength={3}
                                maxLength={200}
                                value={form.title}
                                onChange={(e) =>
                                  updateField("title", e.target.value)
                                }
                                placeholder="e.g. Data Structures and Algorithms"
                              />
                            </Field>
                            <Field label="Category" required>
                              <select
                                className={inputClass}
                                required
                                value={form.category}
                                onChange={(e) =>
                                  updateField("category", e.target.value)
                                }
                              >
                                {CATEGORIES.map((category) => (
                                  <option key={category}>{category}</option>
                                ))}
                              </select>
                            </Field>
                          </div>
                          <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
                            <Field
                              label="Course Description"
                              required
                              hint={`${form.description.length} characters`}
                            >
                              <textarea
                                className={`${inputClass} min-h-32 resize-y`}
                                required
                                maxLength={10000}
                                value={form.description}
                                onChange={(e) =>
                                  updateField("description", e.target.value)
                                }
                                placeholder="Explain what students will learn and why this course matters."
                              />
                            </Field>
                            <Field
                              label="Thumbnail / Cover Image"
                              hint="Paste an image URL. You can add or change it later."
                            >
                              <div className="space-y-2">
                                <input
                                  className={inputClass}
                                  type="url"
                                  value={form.thumbnail_url}
                                  onChange={(e) =>
                                    updateField("thumbnail_url", e.target.value)
                                  }
                                  placeholder="https://example.com/course-cover.jpg"
                                />
                                {form.thumbnail_url ? (
                                  <div className="flex h-24 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                                    <img
                                      src={form.thumbnail_url}
                                      alt="Course cover preview"
                                      className="h-full w-full object-cover"
                                      onError={(e) => {
                                        e.currentTarget.style.display = "none";
                                      }}
                                    />
                                  </div>
                                ) : (
                                  <div className="flex h-24 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-400">
                                    <ImagePlus className="mb-1 h-5 w-5" />
                                    <span className="text-xs">
                                      Add cover image URL
                                    </span>
                                  </div>
                                )}
                              </div>
                            </Field>
                          </div>
                          <Field
                            label="Short Description"
                            hint={`${form.short_description.length}/500 characters`}
                          >
                            <textarea
                              className={`${inputClass} min-h-20 resize-y`}
                              maxLength={500}
                              value={form.short_description}
                              onChange={(e) =>
                                updateField("short_description", e.target.value)
                              }
                              placeholder="A short summary for course cards (optional)"
                            />
                          </Field>
                          <div className="grid gap-5 sm:grid-cols-3">
                            <Field label="Course Level">
                              <div className="grid grid-cols-3 rounded-xl bg-slate-100 p-1">
                                {["beginner", "intermediate", "advanced"].map(
                                  (level) => (
                                    <button
                                      key={level}
                                      type="button"
                                      onClick={() =>
                                        updateField("difficulty", level)
                                      }
                                      className={`rounded-lg px-1 py-2 text-xs font-semibold capitalize transition ${form.difficulty === level ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                                    >
                                      {level}
                                    </button>
                                  ),
                                )}
                              </div>
                            </Field>
                            <Field label="Language" required>
                              <select
                                className={inputClass}
                                value={form.language}
                                onChange={(e) =>
                                  updateField("language", e.target.value)
                                }
                              >
                                <option value="en">English</option>
                                <option value="hi">Hindi</option>
                                <option value="es">Spanish</option>
                                <option value="fr">French</option>
                                <option value="other">Other</option>
                              </select>
                            </Field>
                            <Field label="Duration (minutes)" required>
                              <div className="relative">
                                <Clock3 className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                                <input
                                  className={`${inputClass} pl-9`}
                                  type="number"
                                  min="0"
                                  value={form.duration_minutes}
                                  onChange={(e) =>
                                    updateField(
                                      "duration_minutes",
                                      e.target.value,
                                    )
                                  }
                                  placeholder="480"
                                />
                              </div>
                            </Field>
                          </div>
                          <section className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 sm:p-5">
                            <div className="mb-4">
                              <h3 className="font-bold text-slate-900">
                                Student-facing course page
                              </h3>
                              <p className="mt-1 text-xs leading-5 text-slate-500">
                                Each item appears on the student course details
                                page. Enter one item per line; FAQ rows use
                                Question | Answer.
                              </p>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                              {[
                                [
                                  "learning_outcomes",
                                  "What students will learn",
                                  "Build production-ready apps\nUnderstand core concepts\nComplete practical exercises",
                                ],
                                [
                                  "skills",
                                  "Skills you’ll gain",
                                  "Python\nPrompt engineering\nRAG",
                                ],
                                [
                                  "requirements",
                                  "Requirements",
                                  "Basic computer knowledge\nInternet access",
                                ],
                                [
                                  "projects",
                                  "Projects students will build",
                                  "AI chatbot\nDocument search assistant",
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
                                <Field
                                  key={key}
                                  label={label}
                                  hint="One item per line"
                                >
                                  <textarea
                                    className={`${inputClass} min-h-28 resize-y`}
                                    value={form[key]}
                                    onChange={(e) =>
                                      updateField(key, e.target.value)
                                    }
                                    placeholder={placeholder}
                                  />
                                </Field>
                              ))}
                              <div className="md:col-span-2">
                                <Field
                                  label="Frequently asked questions"
                                  hint="One FAQ per line, formatted as: Question | Answer"
                                >
                                  <textarea
                                    className={`${inputClass} min-h-24 resize-y`}
                                    value={form.faqs}
                                    onChange={(e) =>
                                      updateField("faqs", e.target.value)
                                    }
                                    placeholder="Do I need prior experience? | No, the course starts with the basics."
                                  />
                                </Field>
                              </div>
                            </div>
                          </section>
                        </div>
                      ) : null}

                      {step === 1 ? (
                        <div className="space-y-6">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <span className="rounded-xl bg-violet-50 p-2.5 text-violet-600">
                                <Layers3 className="h-5 w-5" />
                              </span>
                              <div>
                                <h2 className="font-bold text-slate-900">
                                  2. Course Content
                                </h2>
                                <p className="mt-1 text-sm text-slate-500">
                                  Organize your course into modules and lessons.
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={addModule}
                              className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 px-3.5 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
                            >
                              <Plus className="h-4 w-4" />
                              Add Module
                            </button>
                          </div>
                          <div className="space-y-4">
                            {modules.map((module, moduleIndex) => (
                              <div
                                key={module.id}
                                className="rounded-xl border border-slate-200 p-4"
                              >
                                <div className="mb-3 flex items-center gap-2">
                                  <span className="rounded-lg bg-slate-100 p-2 text-slate-500">
                                    <Layers3 className="h-4 w-4" />
                                  </span>
                                  <div className="flex-1">
                                    <label className="mb-1 block text-xs font-semibold text-slate-500">
                                      MODULE {moduleIndex + 1}
                                    </label>
                                    <input
                                      className={inputClass}
                                      value={module.title}
                                      onChange={(e) =>
                                        updateModule(module.id, e.target.value)
                                      }
                                      placeholder={`e.g. ${moduleIndex === 0 ? "Introduction and Fundamentals" : "Module title"}`}
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removeModule(module.id)}
                                    aria-label="Remove module"
                                    className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                                <div className="ml-2 space-y-2 border-l-2 border-slate-100 pl-4">
                                  {module.lessons.map((lesson, lessonIndex) => (
                                    <div
                                      key={lessonIndex}
                                      className="flex items-center gap-2"
                                    >
                                      <Video className="h-4 w-4 shrink-0 text-slate-400" />
                                      <input
                                        className={`${inputClass} py-2.5`}
                                        value={lesson}
                                        onChange={(e) =>
                                          updateLesson(
                                            module.id,
                                            lessonIndex,
                                            e.target.value,
                                          )
                                        }
                                        placeholder={`Lesson ${lessonIndex + 1} title (optional)`}
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          removeLesson(module.id, lessonIndex)
                                        }
                                        aria-label="Remove lesson"
                                        className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                      >
                                        <X className="h-4 w-4" />
                                      </button>
                                    </div>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() => addLesson(module.id)}
                                    className="inline-flex items-center gap-1.5 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                    Add lesson
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="rounded-xl bg-indigo-50 p-4 text-sm text-indigo-800">
                            <p className="font-semibold">
                              You can attach learning materials after creating
                              the course.
                            </p>
                            <p className="mt-1 text-indigo-700">
                              Open the course workspace to add video uploads,
                              YouTube lessons, quizzes, assignments, and
                              reference files.
                            </p>
                          </div>
                        </div>
                      ) : null}

                      {step === 2 ? (
                        <div className="space-y-6">
                          <div className="flex items-start gap-3">
                            <span className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600">
                              <Globe2 className="h-5 w-5" />
                            </span>
                            <div>
                              <h2 className="font-bold text-slate-900">
                                3. Settings
                              </h2>
                              <p className="mt-1 text-sm text-slate-500">
                                Choose pricing and publishing preferences.
                              </p>
                            </div>
                          </div>
                          <div className="rounded-xl border border-slate-200 p-4">
                            <h3 className="font-semibold text-slate-800">
                              Course pricing
                            </h3>
                            <div className="mt-3 flex flex-wrap gap-3">
                              <button
                                type="button"
                                onClick={() => updateField("is_free", true)}
                                className={`rounded-xl border px-4 py-3 text-sm font-semibold ${form.is_free ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600"}`}
                              >
                                Free course
                              </button>
                              <button
                                type="button"
                                onClick={() => updateField("is_free", false)}
                                className={`rounded-xl border px-4 py-3 text-sm font-semibold ${!form.is_free ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600"}`}
                              >
                                Paid course
                              </button>
                            </div>
                            {!form.is_free ? (
                              <div className="mt-4 grid max-w-xl gap-4 sm:grid-cols-2">
                                <Field
                                  label="Currency"
                                  required
                                  hint="Shown on the student page"
                                >
                                  <select
                                    className={inputClass}
                                    value={form.price_currency}
                                    onChange={(e) =>
                                      updateField(
                                        "price_currency",
                                        e.target.value,
                                      )
                                    }
                                  >
                                    <option value="INR">
                                      INR — Indian Rupee (₹)
                                    </option>
                                    <option value="USD">
                                      USD — US Dollar ($)
                                    </option>
                                  </select>
                                </Field>
                                <Field
                                  label={`Course price (${form.price_currency === "USD" ? "$" : "₹"})`}
                                  required
                                  hint="Enter the amount students see"
                                >
                                  <input
                                    className={inputClass}
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    required
                                    value={form.price_amount}
                                    onChange={(e) =>
                                      updateField(
                                        "price_amount",
                                        e.target.value,
                                      )
                                    }
                                  />
                                </Field>
                              </div>
                            ) : (
                              <p className="mt-3 text-xs text-slate-500">
                                Students can access a free course without a
                                course fee.
                              </p>
                            )}
                          </div>
                          <div className="rounded-xl border border-slate-200 p-4">
                            <h3 className="font-semibold text-slate-800">
                              Visibility
                            </h3>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setVisibility("public");
                                  setPublishAfterCreate(true);
                                }}
                                className={`rounded-xl border p-4 text-left ${visibility === "public" ? "border-indigo-300 bg-indigo-50" : "border-slate-200"}`}
                              >
                                <Globe2
                                  className={`mb-2 h-5 w-5 ${visibility === "public" ? "text-indigo-600" : "text-slate-400"}`}
                                />
                                <span className="block text-sm font-semibold text-slate-800">
                                  Public
                                </span>
                                <span className="mt-1 block text-xs text-slate-500">
                                  Visible in the course catalog once published.
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setVisibility("private");
                                  setPublishAfterCreate(false);
                                }}
                                className={`rounded-xl border p-4 text-left ${visibility === "private" ? "border-indigo-300 bg-indigo-50" : "border-slate-200"}`}
                              >
                                <Eye
                                  className={`mb-2 h-5 w-5 ${visibility === "private" ? "text-indigo-600" : "text-slate-400"}`}
                                />
                                <span className="block text-sm font-semibold text-slate-800">
                                  Private / draft
                                </span>
                                <span className="mt-1 block text-xs text-slate-500">
                                  Keep it as a draft while you finish the
                                  content.
                                </span>
                              </button>
                            </div>
                            <p className="mt-3 text-xs text-slate-500">
                              Visibility selection is a creation preference;
                              final publication controls are available in the
                              course workspace.
                            </p>
                          </div>
                          <p className="rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">
                            {visibility === "public"
                              ? "Public selected: the course will be created and publication will be requested after its modules and lessons are saved."
                              : "Private / draft selected: the course will be created as a draft so you can finish editing before publishing."}
                          </p>
                        </div>
                      ) : null}

                      {step === 3 ? (
                        <div className="space-y-6">
                          <div className="flex items-start gap-3">
                            <span className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
                              <CheckCircle2 className="h-5 w-5" />
                            </span>
                            <div>
                              <h2 className="font-bold text-slate-900">
                                4. Review & Publish
                              </h2>
                              <p className="mt-1 text-sm text-slate-500">
                                Check the details before creating your course.
                              </p>
                            </div>
                          </div>
                          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                            {[
                              ["Course title", form.title || "Not set"],
                              ["Category", form.category],
                              ["Level", levelLabel],
                              ["Language", form.language],
                              [
                                "Duration",
                                form.duration_minutes
                                  ? `${form.duration_minutes} minutes`
                                  : "Not set",
                              ],
                              [
                                "Price",
                                form.is_free
                                  ? "Free"
                                  : priceText(
                                      Math.round(
                                        Number(form.price_amount || 0) * 100,
                                      ),
                                      form.price_currency,
                                    ),
                              ],
                              [
                                "Course outline",
                                `${modules.filter((m) => m.title.trim()).length} modules · ${lessonCount} lessons`,
                              ],
                              [
                                "Next step",
                                publishAfterCreate
                                  ? "Create and publish"
                                  : "Create as draft",
                              ],
                            ].map(([label, value]) => (
                              <div
                                key={label}
                                className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm"
                              >
                                <span className="text-slate-500">{label}</span>
                                <span className="max-w-[65%] text-right font-semibold text-slate-800">
                                  {value}
                                </span>
                              </div>
                            ))}
                          </div>
                          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                            <p className="font-semibold">Course resources</p>
                            <p className="mt-1">
                              After creation, the course workspace lets you
                              attach videos, notes/PDFs, quizzes, and
                              assignments to lessons.
                            </p>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-7">
                      <button
                        type="button"
                        onClick={() =>
                          step === 0
                            ? router.push("/teacher/courses")
                            : (setError(""), setStep((current) => current - 1))
                        }
                        disabled={busy}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {step === 0 ? "Cancel" : "Back"}
                      </button>
                      {step < STEPS.length - 1 ? (
                        <button
                          type="button"
                          onClick={nextStep}
                          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
                        >
                          {step === 0
                            ? "Next: Add Content"
                            : step === 1
                              ? "Next: Settings"
                              : "Review Course"}
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          type="submit"
                          disabled={busy}
                          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60"
                        >
                          <Save className="h-4 w-4" />
                          {busy
                            ? "Creating course…"
                            : publishAfterCreate
                              ? "Create & Publish"
                              : "Create Course"}
                        </button>
                      )}
                    </div>
                  </section>

                  <aside className="space-y-5 xl:sticky xl:top-5">
                    <section
                      id="course-preview"
                      className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
                    >
                      <div className="mb-4 flex items-center justify-between">
                        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                          <Eye className="h-4 w-4 text-indigo-600" />
                          Course Preview
                        </h2>
                        <button
                          type="button"
                          onClick={() =>
                            document
                              .getElementById("course-preview")
                              ?.scrollIntoView({
                                behavior: "smooth",
                                block: "center",
                              })
                          }
                          className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                        >
                          Preview
                        </button>
                      </div>
                      <div className="relative min-h-[136px] overflow-hidden rounded-xl bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-950 p-5 text-white">
                        {form.thumbnail_url ? (
                          <img
                            src={form.thumbnail_url}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover opacity-30"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : null}
                        <div className="relative flex items-start gap-4">
                          <div className="rounded-xl bg-indigo-500/90 p-3">
                            <BookOpen className="h-7 w-7" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="break-words text-lg font-bold leading-tight">
                              {form.title || "Your course title"}
                            </h3>
                            <p className="mt-2 line-clamp-2 text-xs text-indigo-100">
                              {form.short_description ||
                                form.description ||
                                "Your course introduction will appear here."}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 border-b border-slate-100 py-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1.5">
                          <Layers3 className="h-4 w-4 text-indigo-500" />
                          {levelLabel}
                        </span>
                        <span className="flex items-center justify-center gap-1.5">
                          <Clock3 className="h-4 w-4 text-indigo-500" />
                          {durationLabel}
                        </span>
                        <span className="flex items-center justify-end gap-1.5">
                          <Globe2 className="h-4 w-4 text-indigo-500" />
                          {form.language.toUpperCase()}
                        </span>
                      </div>
                      <div className="py-4">
                        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
                          <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                          What you’ll learn
                        </h3>
                        <p className="text-sm leading-6 text-slate-600">
                          {form.description ||
                            "Add a course description to help students understand what they will learn."}
                        </p>
                      </div>
                      <div className="border-t border-slate-100 pt-4">
                        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
                          <Folder className="h-4 w-4 text-indigo-600" />
                          Course Resources
                        </h3>
                        <div className="space-y-1">
                          {[
                            [
                              FileText,
                              "Notes / PDF",
                              "Add reference material after creation",
                            ],
                            [
                              Video,
                              "Video",
                              "Attach uploaded or YouTube videos",
                            ],
                            [Layers3, "Quiz", "Create practice quizzes"],
                            [
                              FileText,
                              "Assignment",
                              "Add assignments for practice",
                            ],
                          ].map(([Icon, label, description]) => (
                            <div
                              key={label}
                              className="flex items-center gap-3 rounded-lg px-2 py-2"
                            >
                              <Icon className="h-4 w-4 shrink-0 text-indigo-600" />
                              <div>
                                <p className="text-xs font-semibold text-slate-700">
                                  {label}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  {description}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </section>
                    <section className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50 p-4">
                      <div className="flex items-start gap-3">
                        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
                        <div>
                          <h3 className="text-sm font-bold text-indigo-950">
                            LearnMate AI tools
                          </h3>
                          <p className="mt-1 text-xs leading-5 text-indigo-800">
                            After adding course content, use the course
                            workspace to create quizzes, summaries, and learning
                            materials with available AI tools.
                          </p>
                          <button
                            type="button"
                            onClick={() => setShowHelp((value) => !value)}
                            className="mt-3 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm hover:bg-indigo-100"
                          >
                            {showHelp ? "Hide details" : "Learn More"}
                          </button>
                          {showHelp ? (
                            <p className="mt-3 border-t border-indigo-200 pt-3 text-xs leading-5 text-indigo-900">
                              For best results, add clear module and lesson
                              titles first, then attach the relevant videos or
                              learning materials from the course workspace. AI
                              actions use the content available there.
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </section>
                  </aside>
                </div>
              </form>
            </div>
          </main>
        </div>
      </div>
      {previewOpen ? (
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
          modules={modules.map((module) => ({
            ...module,
            lessons: module.lessons.filter((lesson) => lesson.trim()),
          }))}
          instructor={user}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </div>
  );
}
