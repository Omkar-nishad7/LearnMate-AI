import { api, apiPaths } from "@/lib/api";

export async function exportNotes(payload) {
  const { data } = await api.post(apiPaths.exports.notes, payload);
  return data;
}

export async function exportQuizResults(payload) {
  const { data } = await api.post(apiPaths.exports.quizResults, payload);
  return data;
}