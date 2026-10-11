"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  CheckCircle2,
  Circle,
  Eye,
  Loader2,
  RotateCcw,
  XCircle,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import {
  fetchLatestQuizAttempt,
  fetchQuizById,
  startQuizAttempt,
  submitQuizAttempt,
} from "@/services/quiz";

function answerLabel(question, answer) {
  if (answer === null || answer === undefined || answer === "")
    return "Not answered";
  if (
    question?.options &&
    Object.prototype.hasOwnProperty.call(question.options, answer)
  ) {
    return `${answer}: ${question.options[answer]}`;
  }
  return String(answer);
}

export default function StudentQuizDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [attemptId, setAttemptId] = useState(null);
  const [busy, setBusy] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!id) return;

    let active = true;
    async function load() {
      setBusy(true);
      setError("");
      try {
        const quizData = await fetchQuizById(id);
        if (!active) return;
        setQuiz(quizData);

        try {
          const latest = await fetchLatestQuizAttempt(id);
          if (!active) return;
          setResult(latest);
        } catch (e) {
          // A 404 simply means the student has not completed this quiz yet.
          if (e?.status !== 404) throw e;
        }
      } catch (e) {
        if (active) setError(e.message || "Unable to load quiz.");
      } finally {
        if (active) setBusy(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [id]);

  const resultAnswers = useMemo(() => {
    const map = new Map();
    (result?.answers || []).forEach((answer) =>
      map.set(answer.question_id, answer),
    );
    return map;
  }, [result]);

  async function start() {
    if (starting || !id) return;
    setStarting(true);
    setError("");
    setAnswers({});
    setResult(null);
    try {
      const data = await startQuizAttempt(id);
      setAttemptId(data.attempt_id);
      setQuiz(data.quiz);
    } catch (e) {
      setError(e.message || "Unable to start quiz.");
    } finally {
      setStarting(false);
    }
  }

  function setAnswer(questionId, value) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  }

  async function submit() {
    if (!attemptId || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const data = await submitQuizAttempt(attemptId, {
        answers: Object.entries(answers).map(([question_id, given_answer]) => ({
          question_id: Number(question_id),
          given_answer,
        })),
      });
      setResult(data);
      setAttemptId(null);
    } catch (e) {
      setError(e.message || "Unable to submit quiz.");
    } finally {
      setSubmitting(false);
    }
  }

  const questions = quiz?.questions || [];
  const reviewing = Boolean(result);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <Sidebar role="student" />
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            title={quiz?.title || "Quiz"}
            subtitle="AI-generated learning assessment"
            user={{ full_name: "Student", role: "Student" }}
          />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl space-y-6">
              {error ? (
                <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              {busy && !quiz ? (
                <Card className="p-10 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-600" />
                  <p className="mt-3 text-sm text-slate-500">Loading quiz...</p>
                </Card>
              ) : null}

              {quiz ? (
                <>
                  <PageHeader
                    title={quiz.title}
                    description={`${quiz.total_points} points · ${questions.length} questions`}
                  />

                  {reviewing ? (
                    <Card className="p-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-500">
                            Attempt result
                          </p>
                          <p className="mt-1 text-2xl font-semibold text-slate-900">
                            {Number(result.percentage || 0).toFixed(1)}%
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            Score: {result.score} / {result.max_score}
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium ${
                            result.passed
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {result.passed ? "Passed" : "Needs Review"}
                        </span>
                      </div>
                      <div className="mt-5 flex flex-wrap gap-2">
                        {quiz.max_attempts > 1 ? (
                          <button
                            type="button"
                            onClick={start}
                            disabled={starting}
                            className="btn-primary"
                          >
                            {starting ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <RotateCcw className="mr-2 h-4 w-4" />
                            )}
                            Retake Quiz
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => router.push("/student/quizzes")}
                          className="btn-secondary"
                        >
                          Back to Quizzes
                        </button>
                      </div>
                    </Card>
                  ) : null}

                  {!reviewing && !attemptId ? (
                    <Card className="p-6">
                      <div className="flex items-start gap-3 rounded-xl bg-blue-50 p-4">
                        <Eye className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                        <div>
                          <p className="font-medium text-slate-900">
                            Quiz preview
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            Review all questions below. Your correct answers are
                            hidden until you submit an attempt.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={start}
                        disabled={starting}
                        className="btn-primary mt-5 w-full sm:w-auto"
                      >
                        {starting ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Start Quiz
                      </button>
                    </Card>
                  ) : null}

                  <div className="space-y-5">
                    {questions.map((question, index) => {
                      const reviewAnswer = resultAnswers.get(question.id);
                      const selected = reviewAnswer?.given_answer;
                      const correct = reviewAnswer?.correct_answer;
                      const isCorrect = reviewAnswer?.is_correct;

                      return (
                        <Card key={question.id} className="p-5">
                          <div className="flex items-start gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-sm font-semibold text-blue-700">
                              {index + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-slate-900">
                                {question.question_text}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {question.points} point
                                {question.points === 1 ? "" : "s"}
                              </p>
                            </div>
                            {reviewing ? (
                              isCorrect ? (
                                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                              ) : (
                                <XCircle className="h-5 w-5 shrink-0 text-red-500" />
                              )
                            ) : null}
                          </div>

                          {question.options &&
                          Object.keys(question.options).length ? (
                            <div className="mt-4 space-y-2">
                              {Object.entries(question.options).map(
                                ([value, option]) => {
                                  const isSelected =
                                    !reviewing &&
                                    answers[question.id] === value;
                                  const isUserAnswer =
                                    reviewing && selected === value;
                                  const isCorrectOption =
                                    reviewing && correct === value;
                                  return (
                                    <label
                                      key={value}
                                      className={`flex items-center gap-3 rounded-xl border p-3 text-sm ${
                                        isCorrectOption
                                          ? "border-emerald-300 bg-emerald-50"
                                          : isUserAnswer && !isCorrect
                                            ? "border-red-300 bg-red-50"
                                            : "border-slate-200"
                                      } ${!reviewing ? "cursor-pointer hover:bg-slate-50" : ""}`}
                                    >
                                      {!reviewing ? (
                                        <input
                                          type="radio"
                                          name={`q-${question.id}`}
                                          checked={isSelected}
                                          onChange={() =>
                                            setAnswer(question.id, value)
                                          }
                                        />
                                      ) : (
                                        <Circle className="h-4 w-4 shrink-0 text-slate-300" />
                                      )}
                                      <span className="font-medium text-slate-600">
                                        {value}
                                      </span>
                                      <span>{option}</span>
                                    </label>
                                  );
                                },
                              )}
                            </div>
                          ) : (
                            <input
                              className="input-ui mt-4 w-full"
                              placeholder={reviewing ? "Answer" : "Your answer"}
                              value={
                                reviewing
                                  ? selected || ""
                                  : answers[question.id] || ""
                              }
                              readOnly={reviewing}
                              onChange={(e) =>
                                setAnswer(question.id, e.target.value)
                              }
                            />
                          )}

                          {reviewing ? (
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              <div className="rounded-xl bg-slate-50 p-3">
                                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                  Your answer
                                </p>
                                <p className="mt-1 text-sm text-slate-900">
                                  {answerLabel(question, selected)}
                                </p>
                              </div>
                              <div className="rounded-xl bg-emerald-50 p-3">
                                <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                                  Correct answer
                                </p>
                                <p className="mt-1 text-sm text-emerald-900">
                                  {answerLabel(question, correct)}
                                </p>
                              </div>
                            </div>
                          ) : null}
                        </Card>
                      );
                    })}
                  </div>

                  {attemptId ? (
                    <button
                      onClick={submit}
                      disabled={submitting}
                      className="btn-primary w-full"
                    >
                      {submitting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                      )}
                      Submit Quiz
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
