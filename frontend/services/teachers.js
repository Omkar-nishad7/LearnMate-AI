import { api, apiPaths } from "@/lib/api";

export async function fetchTeacherProfile(id) {
  const { data } = await api.get(apiPaths.teachers.profile(id));
  return data;
}
