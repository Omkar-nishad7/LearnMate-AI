import { api, apiPaths } from "@/lib/api";

export async function askTutor(payload) {
  const { data } = await api.post(apiPaths.ai.tutor, payload);
  return data;
}

export async function getTutorConversations({ page = 1, page_size = 20 } = {}) {
  const { data } = await api.get(apiPaths.ai.tutorConversations, {
    params: { page, page_size }
  });
  return data;
}

export async function getTutorConversationById(id) {
  const { data } = await api.get(apiPaths.ai.tutorConversation(id));
  return data;
}

export async function summarizeVideo(payload) {
  const { data } = await api.post(apiPaths.ai.summarize, payload);
  return data;
}

export async function generateNotesFromVideo(payload) {
  const { data } = await api.post(apiPaths.ai.generateNotes, payload);
  return data;
}

export async function generateQuizFromVideo(payload) {
  const { data } = await api.post(apiPaths.ai.generateQuiz, payload);
  return data;
}

export async function getAIUsage(feature = "tutor") {
  const { data } = await api.get(apiPaths.ai.usage, {
    params: { feature }
  });
  return data;
}
export async function generateTeacherAssignment(payload) {
  const { data } = await api.post(apiPaths.teacherAI.assignment, payload);
  return data;
}
