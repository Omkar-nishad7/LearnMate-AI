import ProtectedRoute from "@/app/student/layout/ProtectedRoute";

export default function TeacherLayout({ children }) {
  return <ProtectedRoute role="TEACHER">{children}</ProtectedRoute>;
}
