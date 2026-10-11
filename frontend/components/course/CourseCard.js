import Link from "next/link";
import { BookOpen } from "lucide-react";
import Card from "@/components/ui/Card";

export default function CourseCard({
  id,
  title,
  category,
  lessons,
  duration,
  rating,
  progress
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
          <BookOpen className="h-5 w-5" />
        </div>
        {category ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {category}
          </span>
        ) : null}
      </div>

      <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>

      <div className="mt-4 grid grid-cols-3 gap-3 text-sm text-slate-500">
        <div className="rounded-xl bg-slate-50 p-3 text-center">
          <p className="font-semibold text-slate-900">{lessons}</p>
          <p>Lessons</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 text-center">
          <p className="font-semibold text-slate-900">{duration}</p>
          <p>Duration</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 text-center">
          <p className="font-semibold text-slate-900">{rating}</p>
          <p>Rating</p>
        </div>
      </div>

      {typeof progress === "number" ? (
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-slate-500">Progress</span>
            <span className="font-medium text-slate-900">{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-blue-600"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : null}

      {id ? (
        <Link href={`/student/courses/${id}`} className="btn-primary mt-5 w-full">
          Continue Learning
        </Link>
      ) : null}
    </Card>
  );
}