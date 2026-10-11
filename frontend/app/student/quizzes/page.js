"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ClipboardList,
  Copy,
  Eye,
  ExternalLink,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import { deleteStudentQuiz, fetchStudentQuizzes } from "@/services/quiz";

export default function StudentQuizzesPage() {
  const [quizzes, setQuizzes] = useState([]);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  const loadQuizzes = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setBusy(true);
    setError("");

    try {
      const data = await fetchStudentQuizzes();
      setQuizzes(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Unable to load quizzes.");
    } finally {
      if (silent) setRefreshing(false);
      else setBusy(false);
    }
  }, []);

  useEffect(() => {
    loadQuizzes();
  }, [loadQuizzes]);

  async function copyQuizLink(quizId) {
    try {
      const url = `${window.location.origin}/student/quizzes/${quizId}`;
      await navigator.clipboard.writeText(url);
      setCopiedId(quizId);
      window.setTimeout(() => setCopiedId(null), 1600);
    } catch {
      setError("Unable to copy the quiz link.");
    }
  }

  async function handleDelete(quiz) {
    if (!quiz.can_delete || deletingId) return;
    const confirmed = window.confirm(
      `Delete “${quiz.title}”? This AI-generated quiz and its attempts will be permanently removed.`,
    );
    if (!confirmed) return;

    setDeletingId(quiz.id);
    setError("");
    try {
      await deleteStudentQuiz(quiz.id);
      setQuizzes((current) => current.filter((item) => item.id !== quiz.id));
    } catch (e) {
      setError(e.message || "Unable to delete quiz.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <Sidebar role="student" />
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            title="Quizzes"
            subtitle="Practice and test your understanding"
            user={{ full_name: "Student", role: "Student" }}
          />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl space-y-6">
              <PageHeader
                title="My Quizzes"
                description="AI-generated and assigned quizzes available for your account."
                action={
                  <button
                    type="button"
                    onClick={() => loadQuizzes({ silent: true })}
                    disabled={busy || refreshing}
                    className="btn-secondary"
                  >
                    <RefreshCw
                      className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                    />
                    {refreshing ? "Refreshing..." : "Refresh"}
                  </button>
                }
              />

              {error ? (
                <div className="flex items-center justify-between gap-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  <span>{error}</span>
                  <button
                    type="button"
                    onClick={() => loadQuizzes()}
                    className="font-medium underline underline-offset-2"
                  >
                    Retry
                  </button>
                </div>
              ) : null}

              {busy ? (
                <Card className="p-10 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-600" />
                  <p className="mt-3 text-sm text-slate-500">
                    Loading quizzes...
                  </p>
                </Card>
              ) : null}

              {!busy && quizzes.length === 0 ? (
                <Card className="p-10 text-center">
                  <ClipboardList className="mx-auto h-10 w-10 text-slate-400" />
                  <p className="mt-3 font-medium">No quizzes yet</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Generate a quiz from a video to see it here.
                  </p>
                  <Link
                    href="/student/videos"
                    className="btn-primary mt-5 inline-flex"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Go to My Videos
                  </Link>
                </Card>
              ) : null}

              {!busy && quizzes.length > 0 ? (
                <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {quizzes.map((quiz) => (
                    <Card
                      key={quiz.id}
                      className="flex h-full flex-col p-5 transition-shadow hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                          <ClipboardList className="h-5 w-5 text-blue-600" />
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            quiz.attempted
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {quiz.attempted ? "ATTEMPTED" : "NOT ATTEMPTED"}
                        </span>
                      </div>

                      <div className="mt-4 flex-1">
                        <h2 className="line-clamp-2 font-semibold text-slate-900">
                          {quiz.title}
                        </h2>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                          <span>{quiz.total_points} points</span>
                          <span aria-hidden="true">•</span>
                          <span>
                            {quiz.is_ai_generated ? "AI generated" : "Assigned"}
                          </span>
                        </div>
                        {quiz.description ? (
                          <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-500">
                            {quiz.description}
                          </p>
                        ) : null}

                        {quiz.attempted ? (
                          <div className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-slate-500">
                                Latest score
                              </span>
                              <span className="font-semibold text-slate-900">
                                {Number(quiz.attempt_percentage || 0).toFixed(
                                  1,
                                )}
                                %
                              </span>
                            </div>
                            <p
                              className={`mt-1 text-xs font-medium ${
                                quiz.attempt_passed
                                  ? "text-emerald-600"
                                  : "text-amber-600"
                              }`}
                            >
                              {quiz.attempt_passed
                                ? "Passed"
                                : "Completed — review your answers"}
                            </p>
                          </div>
                        ) : (
                          <p className="mt-4 text-xs text-slate-500">
                            Open the quiz to see every question and start your
                            attempt.
                          </p>
                        )}
                      </div>

                      <div className="mt-5 grid grid-cols-[1fr_auto_auto] gap-2">
                        <Link
                          href={`/student/quizzes/${quiz.id}`}
                          className="btn-primary"
                        >
                          {quiz.attempted ? (
                            <>
                              <Eye className="mr-2 h-4 w-4" />
                              Review Attempt
                            </>
                          ) : (
                            <>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Take Quiz
                            </>
                          )}
                        </Link>
                        <button
                          type="button"
                          onClick={() => copyQuizLink(quiz.id)}
                          className="btn-secondary px-3"
                          title="Copy quiz link"
                          aria-label={`Copy link for ${quiz.title}`}
                        >
                          {copiedId === quiz.id ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                        {quiz.can_delete ? (
                          <button
                            type="button"
                            onClick={() => handleDelete(quiz)}
                            disabled={deletingId === quiz.id}
                            className="btn-secondary px-3 text-red-600 hover:border-red-200 hover:bg-red-50"
                            title="Delete quiz"
                            aria-label={`Delete ${quiz.title}`}
                          >
                            {deletingId === quiz.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        ) : (
                          <span aria-hidden="true" />
                        )}
                      </div>
                      {copiedId === quiz.id ? (
                        <p className="mt-2 text-xs text-emerald-600">
                          Quiz link copied.
                        </p>
                      ) : null}
                    </Card>
                  ))}
                </section>
              ) : null}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
