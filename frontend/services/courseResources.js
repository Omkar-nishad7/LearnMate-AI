import { api, apiPaths } from "@/lib/api";

export async function fetchTeacherResources() {
  const { data } = await api.get(apiPaths.courseResources.teacherList);
  return Array.isArray(data) ? data : [];
}

export async function fetchTeacherCourseResources(courseId) {
  const { data } = await api.get(apiPaths.courseResources.teacherCourse(courseId));
  return Array.isArray(data) ? data : [];
}

export async function fetchCourseResources(courseId) {
  const { data } = await api.get(apiPaths.courseResources.course(courseId));
  return Array.isArray(data) ? data : [];
}

export async function createCourseResource(courseId, payload) {
  const { data } = await api.post(apiPaths.courseResources.createTeacherCourse(courseId), payload);
  return data;
}

export async function deleteCourseResource(courseId, resourceId) {
  await api.delete(apiPaths.courseResources.removeTeacherCourse(courseId, resourceId));
}

export function resolveCourseResourceUrl(url) {
  if (!url || typeof url !== "string") return "";
  if (/^https?:\/\//i.test(url) || url.startsWith("blob:")) return url;
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "/api/v1";
  if (/^https?:\/\//i.test(apiBase)) {
    try { return new URL(url, new URL(apiBase).origin).toString(); } catch (_) { return url; }
  }
  return url;
}
