import { api, apiPaths } from "@/lib/api";

export async function fetchStudentAnalytics() {
  const { data } = await api.get(apiPaths.analytics.student);
  return data;
}

export async function fetchTeacherAnalytics() {
  const { data } = await api.get(apiPaths.analytics.teacher);
  return data;
}
