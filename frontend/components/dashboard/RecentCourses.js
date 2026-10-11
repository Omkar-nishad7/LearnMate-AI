import Link from "next/link";
import Card from "@/components/ui/Card";

export default function RecentCourses({ courses = [] }) {
  return (
    <Card className="p-5">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Recent Courses
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Continue from where you left off
          </p>
        </div>
        <Link
          href="/student/courses"
          className="text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          View all
        </Link>
      </div>

      <div className="space-y-4">
        {courses.length ? (
          courses.map((course) => (
            <Link
              key={course.id || course.title}
              href={course.href || "/student/courses"}
              className="block rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-blue-50/60"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="font-semibold text-slate-900">
                    {course.title}
                  </h4>
                  <p className="mt-1 text-sm text-slate-500">
                    {course.lessons || 0} lessons
                  </p>
                </div>
                <div className="text-sm text-slate-600">
                  {typeof course.progress === "number"
                    ? `${course.progress}% complete`
                    : "In progress"}
                </div>
              </div>

              {typeof course.progress === "number" ? (
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-blue-600"
                    style={{ width: `${course.progress}%` }}
                  />
                </div>
              ) : null}
            </Link>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
            No recent courses found.
          </div>
        )}
      </div>
    </Card>
  );
}
