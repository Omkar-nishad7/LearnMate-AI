"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  ExternalLink,
  GraduationCap,
  PlaySquare,
  Youtube,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import Card from "@/components/ui/Card";
import { fetchTeacherProfile } from "@/services/teachers";
import { fetchMyUser } from "@/services/users";

function errorMessage(error, fallback) {
  const detail = error?.data?.detail;
  if (typeof detail === "object" && detail)
    return detail.message || detail.detail || fallback;
  return error?.message || detail || fallback;
}

export default function StudentTeacherProfilePage() {
  const { id } = useParams();
  const [teacher, setTeacher] = useState(null);
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    setError("");
    fetchTeacherProfile(id)
      .then(setTeacher)
      .catch((err) =>
        setError(errorMessage(err, "Unable to load teacher profile.")),
      );
    fetchMyUser()
      .then(setUser)
      .catch(() => {});
  }, [id]);

  const name = teacher?.display_name || teacher?.full_name || "Teacher";
  const initials = name.slice(0, 1).toUpperCase();
  const channel = teacher?.youtube_channel;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <Sidebar role="student" />
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            title="Teacher Channel"
            subtitle="Instructor profile and published courses"
            user={user || { full_name: "Student", role: "Student" }}
          />
          <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto max-w-7xl space-y-6">
              {error ? (
                <Card className="border-red-200 bg-red-50 p-5 text-sm text-red-700">
                  {error}
                </Card>
              ) : null}
              {!teacher ? (
                <Card className="p-12 text-center text-sm text-slate-500">
                  Loading teacher channel…
                </Card>
              ) : (
                <>
                  <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                    <div className="h-36 bg-gradient-to-r from-blue-950 via-slate-900 to-slate-800 sm:h-48" />
                    <div className="px-5 pb-6 sm:px-8">
                      <div className="-mt-12 flex flex-col gap-5 sm:-mt-16 sm:flex-row sm:items-end">
                        {teacher.avatar_url ? (
                          <img
                            src={teacher.avatar_url}
                            alt=""
                            className="h-24 w-24 rounded-full border-4 border-white object-cover shadow-lg sm:h-32 sm:w-32"
                          />
                        ) : (
                          <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-blue-50 text-3xl font-black text-blue-700 shadow-lg sm:h-32 sm:w-32 sm:text-4xl">
                            {initials}
                          </div>
                        )}
                        <div className="min-w-0 flex-1 pb-1">
                          <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">
                            {name}
                          </h1>
                          {teacher.organization ? (
                            <p className="mt-1 text-sm text-slate-500">
                              {teacher.organization}
                            </p>
                          ) : null}
                          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                            {teacher.bio ||
                              "Welcome to this teacher's LearnMate channel."}
                          </p>
                        </div>
                        {channel?.channel_url ? (
                          <a
                            href={channel.channel_url}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-primary shrink-0"
                          >
                            <Youtube className="mr-2 h-4 w-4" /> YouTube Channel{" "}
                            <ExternalLink className="ml-2 h-4 w-4" />
                          </a>
                        ) : null}
                      </div>
                      <div className="mt-6 flex flex-wrap gap-2 text-sm">
                        <span className="rounded-full bg-slate-100 px-4 py-2 font-semibold text-slate-700">
                          {teacher.courses?.length || 0} published courses
                        </span>
                        {channel?.video_count != null ? (
                          <span className="rounded-full bg-slate-100 px-4 py-2 font-semibold text-slate-700">
                            {channel.video_count} YouTube videos
                          </span>
                        ) : null}
                        {channel?.subscriber_count != null ? (
                          <span className="rounded-full bg-slate-100 px-4 py-2 font-semibold text-slate-700">
                            {channel.subscriber_count} subscribers
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </section>

                  {channel ? (
                    <Card className="border-0 p-5 shadow-sm sm:p-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                          <PlaySquare className="h-6 w-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                            YouTube channel
                          </p>
                          <h2 className="mt-1 font-bold text-slate-900">
                            {channel.channel_title || name}
                          </h2>
                          <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                            {channel.description ||
                              "Teacher's external video resources."}
                          </p>
                        </div>
                        <a
                          href={channel.channel_url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-secondary shrink-0"
                        >
                          Open channel <ExternalLink className="ml-2 h-4 w-4" />
                        </a>
                      </div>
                    </Card>
                  ) : null}

                  <section>
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <h2 className="text-2xl font-black text-slate-900">
                          Courses
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                          Published LearnMate courses from {name}.
                        </p>
                      </div>
                      <GraduationCap className="h-7 w-7 text-blue-600" />
                    </div>
                    {teacher.courses?.length ? (
                      <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                        {teacher.courses.map((course) => (
                          <Card
                            key={course.id}
                            className="group overflow-hidden border-0 p-0 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
                          >
                            <div className="aspect-video overflow-hidden bg-slate-100">
                              {course.thumbnail_url ? (
                                <img
                                  src={course.thumbnail_url}
                                  alt=""
                                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center text-slate-300">
                                  <BookOpen className="h-12 w-12" />
                                </div>
                              )}
                            </div>
                            <div className="p-5">
                              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">
                                  {course.category || "General"}
                                </span>
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                                  {course.difficulty || "All levels"}
                                </span>
                              </div>
                              <h3 className="mt-3 line-clamp-2 text-lg font-bold text-slate-900">
                                {course.title}
                              </h3>
                              <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">
                                {course.short_description ||
                                  "Explore this published course."}
                              </p>
                              <Link
                                href={`/student/courses/${course.id}`}
                                className="btn-primary mt-5 w-full justify-center"
                              >
                                Open Course{" "}
                                <ExternalLink className="ml-2 h-4 w-4" />
                              </Link>
                            </div>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <Card className="mt-5 p-10 text-center">
                        <BookOpen className="mx-auto h-10 w-10 text-slate-300" />
                        <p className="mt-3 font-semibold text-slate-900">
                          No published courses yet
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          New courses from this teacher will appear here after
                          publication.
                        </p>
                      </Card>
                    )}
                  </section>
                </>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
