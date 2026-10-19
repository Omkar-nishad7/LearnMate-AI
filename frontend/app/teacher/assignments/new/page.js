"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  ClipboardList,
  Clock3,
  BookOpenCheck,
  CircleHelp,
  GripVertical,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import { api } from "@/lib/api";
import { fetchTeacherAllCourses } from "@/services/courses";
import { fetchMyUser } from "@/services/users";

const makeQuestion = () => ({
  id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  question: "",
  options: ["", "", "", ""],
  correct_option: 0,
});

function messageOf(error, fallback) {
  const detail = error?.data?.detail;
  if (typeof detail === "object" && detail)
    return detail.message || detail.detail || fallback;
  return error?.message || detail || fallback;
}

function FieldLabel({ children, required }) {
  return (
    <label className="mb-2 block text-sm font-semibold text-slate-800">
      {children}
      {required ? <span className="ml-1 text-orange-500">*</span> : null}
    </label>
  );
}

export default function NewAssignmentPage() {
  const router = useRouter();
  const [courses, setCourses] = useState([]);
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    course_id: "",
    title: "",
    description: "",
    instructions: "",
    max_score: 100,
    due_at: "",
    allow_late: false,
    questions: [makeQuestion()],
  });

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(
        "learnmate:generated-assignment",
      );
      if (raw) {
        const draft = JSON.parse(raw);
        setForm((current) => ({
          ...current,
          course_id: draft.course_id
            ? String(draft.course_id)
            : current.course_id,
          title: draft.title || current.title,
          description: draft.description || current.description,
          instructions: draft.instructions || current.instructions,
          max_score: Number(draft.max_score || current.max_score),
        }));
        window.sessionStorage.removeItem("learnmate:generated-assignment");
      }
    } catch (_) {
      window.sessionStorage.removeItem("learnmate:generated-assignment");
    }
    Promise.all([fetchTeacherAllCourses(), fetchMyUser()])
      .then(([c, u]) => {
        setCourses(c.items || []);
        setUser(u);
      })
      .catch((e) => setError(messageOf(e, "Unable to load your courses.")));
  }, []);

  const totalQuestions = form.questions.length;
  const answeredQuestions = useMemo(
    () => form.questions.filter((q) => q.question.trim()).length,
    [form.questions],
  );

  function updateQuestion(index, key, value) {
    setForm((f) => ({
      ...f,
      questions: f.questions.map((q, i) =>
        i === index ? { ...q, [key]: value } : q,
      ),
    }));
  }
  function updateOption(qi, oi, value) {
    setForm((f) => ({
      ...f,
      questions: f.questions.map((q, i) =>
        i === qi
          ? { ...q, options: q.options.map((o, j) => (j === oi ? value : o)) }
          : q,
      ),
    }));
  }
  function addQuestion() {
    setForm((f) => ({ ...f, questions: [...f.questions, makeQuestion()] }));
  }
  function removeQuestion(index) {
    setForm((f) => ({
      ...f,
      questions:
        f.questions.length === 1
          ? f.questions
          : f.questions.filter((_, i) => i !== index),
    }));
  }
  async function save(e) {
    e.preventDefault();
    setError("");
    if (!form.course_id || !form.title.trim())
      return setError("Select a course and enter an assignment title.");
    if (!form.description.trim())
      return setError(
        "Add a short description so students understand the assignment.",
      );
    if (
      form.questions.some(
        (q) => !q.question.trim() || q.options.some((o) => !o.trim()),
      )
    )
      return setError("Complete every question and all four options.");
    setSaving(true);
    try {
      await api.post("/assignments", {
        ...form,
        course_id: Number(form.course_id),
        max_score: Number(form.max_score),
        due_at: form.due_at || null,
      });
      router.push("/teacher/assignments");
    } catch (e) {
      setError(messageOf(e, "Unable to create assignment."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <Sidebar role="teacher" />
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            title="New Assignment"
            subtitle="Build a clear, student-friendly MCQ assessment"
            user={user || { full_name: "Teacher", role: "Teacher" }}
          />
          <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto max-w-5xl space-y-6">
              <PageHeader
                title="Create Assignment"
                description="Choose a course, add instructions, then build your questions one by one."
              />

              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-3">
                <Card className="border-0 p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700">
                      <BookOpenCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Course</p>
                      <p className="font-semibold text-slate-900">
                        {form.course_id ? "Selected" : "Not selected"}
                      </p>
                    </div>
                  </div>
                </Card>
                <Card className="border-0 p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-orange-50 p-2.5 text-orange-600">
                      <CircleHelp className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Questions</p>
                      <p className="font-semibold text-slate-900">
                        {answeredQuestions}/{totalQuestions} ready
                      </p>
                    </div>
                  </div>
                </Card>
                <Card className="border-0 p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
                      <ClipboardList className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Max score</p>
                      <p className="font-semibold text-slate-900">
                        {Number(form.max_score) || 0} points
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              <form onSubmit={save} className="space-y-6">
                <Card className="border-0 p-5 shadow-sm sm:p-7">
                  <div className="mb-6">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
                      Step 1
                    </p>
                    <h2 className="mt-1 text-xl font-bold text-slate-900">
                      Assignment details
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Keep the information simple and clear for students.
                    </p>
                  </div>
                  <div className="space-y-5">
                    <div>
                      <FieldLabel required>Course</FieldLabel>
                      <select
                        className="input h-12"
                        value={form.course_id}
                        onChange={(e) =>
                          setForm({ ...form, course_id: e.target.value })
                        }
                      >
                        <option value="">Select a course</option>
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title} · {c.status}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <FieldLabel required>Assignment title</FieldLabel>
                      <input
                        className="input h-12"
                        maxLength={300}
                        value={form.title}
                        onChange={(e) =>
                          setForm({ ...form, title: e.target.value })
                        }
                        placeholder="e.g. Python Fundamentals — Unit 1"
                      />
                    </div>
                    <div>
                      <FieldLabel required>Description</FieldLabel>
                      <textarea
                        className="input min-h-32 resize-y leading-6"
                        maxLength={20000}
                        value={form.description}
                        onChange={(e) =>
                          setForm({ ...form, description: e.target.value })
                        }
                        placeholder="Explain what students will practice, revise, or demonstrate in this assignment."
                      />
                      <p className="mt-1 text-right text-xs text-slate-400">
                        {form.description.length}/20000
                      </p>
                    </div>
                    <div>
                      <FieldLabel>Instructions</FieldLabel>
                      <textarea
                        className="input min-h-28 resize-y leading-6"
                        maxLength={40000}
                        value={form.instructions}
                        onChange={(e) =>
                          setForm({ ...form, instructions: e.target.value })
                        }
                        placeholder="Example: Read each question carefully and select one correct answer."
                      />
                      <p className="mt-1 text-right text-xs text-slate-400">
                        {form.instructions.length}/40000
                      </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <FieldLabel>Maximum score</FieldLabel>
                        <input
                          type="number"
                          min="1"
                          max="1000"
                          className="input h-12"
                          value={form.max_score}
                          onChange={(e) =>
                            setForm({ ...form, max_score: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <FieldLabel>Due date</FieldLabel>
                        <div className="relative">
                          <Clock3 className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                          <input
                            type="datetime-local"
                            className="input h-12 pl-10"
                            value={form.due_at}
                            onChange={(e) =>
                              setForm({ ...form, due_at: e.target.value })
                            }
                          />
                        </div>
                      </div>
                    </div>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded"
                        checked={form.allow_late}
                        onChange={(e) =>
                          setForm({ ...form, allow_late: e.target.checked })
                        }
                      />{" "}
                      Allow students to submit after the deadline
                    </label>
                  </div>
                </Card>

                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
                      Step 2
                    </p>
                    <h2 className="mt-1 text-xl font-bold text-slate-900">
                      Questions
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Write the full question in the large field and mark one
                      correct option.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addQuestion}
                    className="btn-secondary shrink-0"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Question
                  </button>
                </div>

                {form.questions.map((q, qi) => (
                  <Card key={q.id} className="border-0 p-5 shadow-sm sm:p-7">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white">
                          {qi + 1}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">
                            Question {qi + 1}
                          </p>
                          <p className="text-xs text-slate-500">
                            One correct answer · four options
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeQuestion(qi)}
                        disabled={form.questions.length === 1}
                        className="rounded-xl p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                        title="Remove question"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-6">
                      <textarea
                        className="input min-h-36 w-full resize-y text-base leading-7"
                        maxLength={2000}
                        value={q.question}
                        onChange={(e) =>
                          updateQuestion(qi, "question", e.target.value)
                        }
                        placeholder="Type the complete question here. You can write a detailed problem statement, code snippet context, or multi-line question."
                      />
                      <div className="mt-1 flex justify-between text-xs text-slate-400">
                        <span>Use the space above for longer questions.</span>
                        <span>{q.question.length}/2000</span>
                      </div>
                    </div>
                    <div className="mt-6 space-y-3">
                      {q.options.map((option, oi) => (
                        <div
                          key={oi}
                          className={`flex items-center gap-3 rounded-2xl border p-3 transition ${q.correct_option === oi ? "border-blue-300 bg-blue-50/60" : "border-slate-200 bg-white"}`}
                        >
                          <input
                            type="radio"
                            name={`correct-${q.id}`}
                            checked={q.correct_option === oi}
                            onChange={() =>
                              updateQuestion(qi, "correct_option", oi)
                            }
                            className="h-4 w-4 shrink-0"
                          />
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">
                            {String.fromCharCode(65 + oi)}
                          </span>
                          <input
                            className="min-w-0 flex-1 border-0 bg-transparent py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400"
                            maxLength={1000}
                            value={option}
                            onChange={(e) =>
                              updateOption(qi, oi, e.target.value)
                            }
                            placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                          />
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}

                <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur sm:flex-row sm:items-center">
                  <p className="hidden text-sm text-slate-500 sm:block">
                    <GripVertical className="mr-1 inline h-4 w-4" />
                    {totalQuestions} question{totalQuestions === 1 ? "" : "s"}{" "}
                    in this assignment
                  </p>
                  <div className="flex w-full gap-3 sm:ml-auto sm:w-auto">
                    <button
                      type="button"
                      onClick={() => router.back()}
                      className="btn-secondary flex-1 sm:flex-none"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={saving}
                      className="btn-primary flex-1 sm:flex-none"
                    >
                      {saving ? "Creating…" : "Create Assignment"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
