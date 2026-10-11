"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus, Trash2, Save, ArrowLeft } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import {
  fetchTeacherAssignment,
  updateAssignment,
} from "@/services/assignments";
import { fetchMyUser } from "@/services/users";
import { fetchTeacherAllCourses } from "@/services/courses";

const makeQuestion = () => ({
  id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  question: "",
  options: ["", "", "", ""],
  correct_option: 0,
});
function errorMessage(error, fallback) {
  const d = error?.data?.detail;
  if (typeof d === "object" && d) return d.message || d.detail || fallback;
  return error?.message || d || fallback;
}

export default function EditAssignmentPage() {
  const { id } = useParams();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [form, setForm] = useState(null);
  const [courseTitle, setCourseTitle] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetchTeacherAssignment(id),
      fetchMyUser(),
      fetchTeacherAllCourses(),
    ])
      .then(([a, u, courseData]) => {
        setUser(u);
        const courses = courseData?.items || [];
        setCourseTitle(
          courses.find((c) => Number(c.id) === Number(a.course_id))?.title ||
            `Course #${a.course_id}`,
        );
        setForm({
          course_id: a.course_id,
          title: a.title || "",
          description: a.description || "",
          instructions: a.instructions || "",
          max_score: a.max_score || 100,
          due_at: a.due_at ? new Date(a.due_at).toISOString().slice(0, 16) : "",
          allow_late: !!a.allow_late,
          questions: a.questions?.length ? a.questions : [makeQuestion()],
        });
      })
      .catch((e) => setError(errorMessage(e, "Unable to load assignment.")));
  }, [id]);

  function updateQuestion(qi, key, value) {
    setForm((f) => ({
      ...f,
      questions: f.questions.map((q, i) =>
        i === qi ? { ...q, [key]: value } : q,
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
  function removeQuestion(qi) {
    setForm((f) => ({
      ...f,
      questions:
        f.questions.length === 1
          ? f.questions
          : f.questions.filter((_, i) => i !== qi),
    }));
  }

  async function save(e) {
    e.preventDefault();
    setError("");
    if (!form?.title.trim() || !form.description.trim())
      return setError("Title and description are required.");
    if (
      form.questions.some(
        (q) => !q.question.trim() || q.options.some((o) => !o.trim()),
      )
    )
      return setError("Complete every question and all four options.");
    setSaving(true);
    try {
      await updateAssignment(id, {
        title: form.title.trim(),
        description: form.description.trim(),
        instructions: form.instructions || null,
        max_score: Number(form.max_score),
        due_at: form.due_at || null,
        allow_late: form.allow_late,
        questions: form.questions,
      });
      router.push("/teacher/assignments");
    } catch (e) {
      setError(errorMessage(e, "Unable to save assignment."));
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
            title="Edit Assignment"
            subtitle="Update questions and assignment settings"
            user={user || { full_name: "Teacher", role: "TEACHER" }}
          />
          <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto max-w-5xl space-y-6">
              <PageHeader
                title="Edit Assignment"
                description="Change the assignment details or update any MCQ. Your course attachment remains unchanged."
                action={
                  <button
                    onClick={() => router.back()}
                    className="btn-secondary inline-flex items-center"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </button>
                }
              />
              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {error}
                </div>
              )}
              {!form ? (
                <Card className="p-10 text-center">Loading assignment…</Card>
              ) : (
                <form onSubmit={save} className="space-y-6">
                  <Card className="border-0 p-5 shadow-sm sm:p-7">
                    <div className="grid gap-5">
                      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-blue-500">
                              Attached course
                            </p>
                            <p className="mt-1 font-bold text-slate-900">
                              {courseTitle}
                            </p>
                          </div>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700">
                            Course locked
                          </span>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-slate-500">
                          The assignment remains attached to this course while
                          you edit its details and questions.
                        </p>
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-semibold">
                          Assignment title
                        </label>
                        <input
                          className="input h-12"
                          value={form.title}
                          onChange={(e) =>
                            setForm({ ...form, title: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-semibold">
                          Description
                        </label>
                        <textarea
                          className="input-ui w-full min-w-0 max-w-none min-h-32 resize-y"
                          value={form.description}
                          onChange={(e) =>
                            setForm({ ...form, description: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-semibold">
                          Instructions
                        </label>
                        <textarea
                          className="input-ui w-full min-w-0 max-w-none min-h-32 resize-y"
                          value={form.instructions}
                          onChange={(e) =>
                            setForm({ ...form, instructions: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-sm font-semibold">
                            Maximum score
                          </label>
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
                          <label className="mb-2 block text-sm font-semibold">
                            Due date
                          </label>
                          <input
                            type="datetime-local"
                            className="input h-12"
                            value={form.due_at}
                            onChange={(e) =>
                              setForm({ ...form, due_at: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                        <input
                          type="checkbox"
                          checked={form.allow_late}
                          onChange={(e) =>
                            setForm({ ...form, allow_late: e.target.checked })
                          }
                        />
                        Allow late submissions
                      </label>
                    </div>
                  </Card>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold">MCQ Questions</h2>
                      <p className="text-sm text-slate-500">
                        One correct option per question.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addQuestion}
                      className="btn-secondary inline-flex items-center"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Question
                    </button>
                  </div>
                  {form.questions.map((q, qi) => (
                    <Card
                      key={q.id || qi}
                      className="border-0 p-5 shadow-sm sm:p-7"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
                            {qi + 1}
                          </span>
                          <span className="font-bold">Question {qi + 1}</span>
                        </div>
                        <button
                          type="button"
                          disabled={form.questions.length === 1}
                          onClick={() => removeQuestion(qi)}
                          className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <textarea
                        className="input-ui mt-5 w-full min-w-0 max-w-none min-h-32 resize-y"
                        value={q.question}
                        onChange={(e) =>
                          updateQuestion(qi, "question", e.target.value)
                        }
                        placeholder="Write the question…"
                      />
                      <div className="mt-4 space-y-2">
                        {q.options.map((o, oi) => (
                          <label
                            key={oi}
                            className={`flex items-center gap-3 rounded-xl border p-3 ${q.correct_option === oi ? "border-blue-300 bg-blue-50" : "border-slate-200"}`}
                          >
                            <input
                              type="radio"
                              checked={q.correct_option === oi}
                              onChange={() =>
                                updateQuestion(qi, "correct_option", oi)
                              }
                            />
                            <span className="font-bold text-xs">
                              {String.fromCharCode(65 + oi)}
                            </span>
                            <input
                              className="min-w-0 flex-1 bg-transparent outline-none"
                              value={o}
                              onChange={(e) =>
                                updateOption(qi, oi, e.target.value)
                              }
                              placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                            />
                          </label>
                        ))}
                      </div>
                    </Card>
                  ))}
                  <div className="sticky bottom-4 z-10 flex justify-end gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur">
                    <button
                      type="button"
                      onClick={() => router.back()}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={saving}
                      className="btn-primary inline-flex items-center"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {saving ? "Saving…" : "Save Changes"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
