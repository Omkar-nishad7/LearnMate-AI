import Card from "@/components/ui/Card";

export default function StudentTable({ students = [] }) {
  return (
    <Card className="p-5">
      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <div className="grid grid-cols-4 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">
          <div>Student</div>
          <div>Course</div>
          <div>Progress</div>
          <div>Status</div>
        </div>

        <div className="divide-y divide-slate-200 bg-white">
          {students.length ? (
            students.map((student) => (
              <div key={student.name} className="grid grid-cols-4 px-4 py-4 text-sm">
                <div className="font-medium text-slate-900">{student.name}</div>
                <div className="text-slate-600">{student.course}</div>
                <div className="text-slate-600">{student.progress}%</div>
                <div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      student.status === "Completed"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-blue-50 text-blue-700"
                    }`}
                  >
                    {student.status}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-6 text-center text-sm text-slate-500">
              No students found.
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}