import Card from "@/components/ui/Card";

export default function CourseTable({ courses = [] }) {
  return (
    <Card className="p-5">
      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <div className="grid grid-cols-4 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">
          <div>Course</div>
          <div>Students</div>
          <div>Lessons</div>
          <div>Status</div>
        </div>

        <div className="divide-y divide-slate-200 bg-white">
          {courses.length ? (
            courses.map((course) => (
              <div key={course.title} className="grid grid-cols-4 px-4 py-4 text-sm">
                <div className="font-medium text-slate-900">{course.title}</div>
                <div className="text-slate-600">{course.students}</div>
                <div className="text-slate-600">{course.lessons}</div>
                <div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                    {course.status || "Published"}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-6 text-center text-sm text-slate-500">
              No courses found.
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}