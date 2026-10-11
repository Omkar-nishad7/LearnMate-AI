import { api, apiPaths } from "@/lib/api";

export async function fetchStudentQuizzes() {
  const { data } = await api.get(apiPaths.quizzes.mine);
  return data;
}

export async function fetchTeacherQuizzes() {
  const { data } = await api.get(apiPaths.quizzes.teacher);
  return data;
}

export async function fetchQuizById(id) {
  const { data } = await api.get(apiPaths.quizzes.detail(id));
  return data;
}

export async function generateQuiz(payload) {
  const { data } = await api.post(apiPaths.ai.generateQuiz, payload);
  return data;
}

export async function startQuizAttempt(id) {
  const { data } = await api.post(apiPaths.quizzes.start(id));
  return data;
}

export async function submitQuizAttempt(attemptId, payload) {
  const { data } = await api.post(apiPaths.quizzes.submitAttempt(attemptId), payload);
  return data;
}

export async function fetchLatestQuizAttempt(quizId) {
  const { data } = await api.get(apiPaths.quizzes.latestAttempt(quizId));
  return data;
}

export async function deleteStudentQuiz(quizId) {
  await api.delete(apiPaths.quizzes.detail(quizId));
}
