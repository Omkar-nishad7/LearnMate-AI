import ProtectedRoute from "./layout/ProtectedRoute";

export default function StudentLayout({ children }) {
  return <ProtectedRoute role="STUDENT">{children}</ProtectedRoute>;
}
