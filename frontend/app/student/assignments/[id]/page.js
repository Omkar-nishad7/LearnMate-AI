"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import {
  fetchAssignment,
  fetchMySubmission,
  submitAssignment,
} from "@/services/assignments";
import { fetchMyUser } from "@/services/users";

function err(e) {
  const d = e?.data?.detail;
  return typeof d === "object"
    ? d.message || d.detail || "Unable to load assignment"
    : e?.message || d || "Unable to load assignment";
}

function formatDate(value) {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No due date";
  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function parseSubmission(content) {
  if (!content) return null;
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export default function StudentAssignmentDetail() {
  const { id } = useParams();
  const router = useRouter();
  const [a, setA] = useState(null);
  const [user, setUser] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const [x, u] = await Promise.all([fetchAssignment(id), fetchMyUser()]);
      setA(x);
      setUser(u);

      if (x?.attempted) {
        try {
          setSubmitted(await fetchMySubmission(id));
        } catch (submissionError) {
          if (submissionError?.status === 404) {
            setSubmitted(null);
          } else {
            throw submissionError;
          }
        }
      } else {
        setSubmitted(null);
      }
    } catch (e) {
      setError(err(e));
    }
  }

  useEffect(() => {
    if (id) load();
  }, [id]);

  async function submit() {
    setError("");
    if (!a || Object.keys(answers).length < a.questions.length) {
      setError("Answer every question before submitting.");
      return;
    }
    setSaving(true);
    try {
      const s = await submitAssignment(id, {
        content: JSON.stringify({ answers }),
      });
      setSubmitted(s);
      await load();
    } catch (e) {
      setError(err(e));
    } finally {
      setSaving(false);
    }
  }

  const submissionAnswers = useMemo(
    () => parseSubmission(submitted?.content)?.answers || {},
    [submitted],
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <Sidebar role="student" />
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            title={a?.title || "Assignment"}
            subtitle="Assignment details"
            user={user || { full_name: "Student", role: "Student" }}
          />
          <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl space-y-6">
              <button
                type="button"
                onClick={() => router.push("/student/assignments")}
                className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-700"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Assignments
              </button>

              <PageHeader
                title={a?.title || "Assignment"}
                description={
                  a?.description || "Choose one answer for each question."
                }
              />

              {error && (
                <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {!a ? (
                <Card className="p-10 text-center">Loading assignment…</Card>
              ) : submitted ? (
                <div className="space-y-5">
                  <Card className="p-6 sm:p-8">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
                          <CheckCircle2 className="h-4 w-4" />
                          Submitted
                        </div>
                        <h2 className="mt-4 text-xl font-bold text-slate-900">
                          Your submission
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                          Your answers were recorded successfully.
                        </p>
                      </div>

                      {submitted.score != null && (
                        <div className="rounded-xl bg-slate-50 px-5 py-4 text-center">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Score
                          </p>
                          <p className="mt-1 text-2xl font-bold text-slate-900">
                            {submitted.score} / {a.max_score}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                          <CalendarDays className="h-4 w-4" />
                          Due date
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {formatDate(a.due_at)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                          <Clock3 className="h-4 w-4" />
                          Submission status
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {submitted.status || "SUBMITTED"}
                        </p>
                      </div>
                    </div>

                    {submitted.feedback && (
                      <div className="mt-5 rounded-xl bg-blue-50 p-4">
                        <p className="text-sm font-semibold text-blue-900">
                          Feedback
                        </p>
                        <p className="mt-1 text-sm text-blue-800">
                          {submitted.feedback}
                        </p>
                      </div>
                    )}
                  </Card>

                  {a.questions?.length > 0 && (
                    <Card className="p-6">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="h-5 w-5 text-blue-600" />
                        <h2 className="text-lg font-bold text-slate-900">
                          Your Answers
                        </h2>
                      </div>
                      <div className="mt-5 space-y-4">
                        {a.questions.map((q, index) => {
                          const selected = submissionAnswers[q.id];
                          return (
                            <div
                              key={q.id}
                              className="rounded-xl border border-slate-200 p-4"
                            >
                              <p className="font-semibold text-slate-900">
                                {index + 1}. {q.question}
                              </p>
                              <p className="mt-2 text-sm text-slate-600">
                                <span className="font-semibold text-slate-800">
                                  Your answer:
                                </span>{" "}
                                {selected != null && q.options?.[selected]
                                  ? q.options[selected]
                                  : "Not available"}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  )}

                  {submitted.file_url && (
                    <Card className="p-5">
                      <a
                        href={submitted.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-800"
                      >
                        <FileText className="h-4 w-4" />
                        Open submitted file
                      </a>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="space-y-5">
                  <Card className="p-5">
                    <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                      <span>
                        <strong className="text-slate-800">Points:</strong>{" "}
                        {a.max_score} pts
                      </span>
                      <span>
                        <strong className="text-slate-800">Due:</strong>{" "}
                        {formatDate(a.due_at)}
                      </span>
                    </div>
                    {a.instructions && (
                      <div className="mt-4 rounded-xl bg-slate-50 p-4">
                        <p className="text-sm font-semibold text-slate-800">
                          Instructions
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                          {a.instructions}
                        </p>
                      </div>
                    )}
                  </Card>

                  {a.questions.map((q, i) => (
                    <Card key={q.id} className="p-6">
                      <div className="flex gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700">
                          {i + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h2 className="font-semibold text-slate-900">
                            {q.question}
                          </h2>
                          <div className="mt-4 space-y-2">
                            {q.options.map((o, oi) => (
                              <label
                                key={oi}
                                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${
                                  answers[q.id] === oi
                                    ? "border-blue-500 bg-blue-50"
                                    : "border-slate-200"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={q.id}
                                  checked={answers[q.id] === oi}
                                  onChange={() =>
                                    setAnswers((x) => ({ ...x, [q.id]: oi }))
                                  }
                                />
                                <span>{o}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}

                  <Card className="p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold">Ready to submit?</p>
                        <p className="text-sm text-slate-500">
                          Your answers will be automatically graded.
                        </p>
                      </div>
                      <button
                        disabled={saving}
                        className="btn-primary"
                        onClick={submit}
                      >
                        {saving ? "Submitting…" : "Submit Assignment"}
                      </button>
                    </div>
                  </Card>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
