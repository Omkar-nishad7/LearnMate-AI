import { api, apiPaths } from "@/lib/api";

export async function completeLesson(lessonId, payload = {}) {
  const { data } = await api.post(apiPaths.progress.completeLesson(lessonId), payload);
  return data;
}

export async function updateVideoProgress(videoId, payload = {}) {
  const { data } = await api.post(apiPaths.progress.video(videoId), payload);
  return data;
}

export async function getCourseProgress(courseId) {
  const { data } = await api.get(apiPaths.progress.course(courseId));
  return data;
}

export async function getLessonProgress(lessonId) {
  const { data } = await api.get(apiPaths.progress.lesson(lessonId));
  return data;
}
