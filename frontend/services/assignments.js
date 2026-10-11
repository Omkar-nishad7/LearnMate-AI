import { api, apiPaths } from "@/lib/api";

export async function fetchAssignments() {
  const { data } = await api.get(apiPaths.assignments.list);
  return data || [];
}

export async function fetchAssignment(id) {
  const { data } = await api.get(apiPaths.assignments.detail(id));
  return data;
}

export async function fetchTeacherAssignment(id) {
  const { data } = await api.get(apiPaths.assignments.teacherDetail(id));
  return data;
}

export async function fetchTeacherAssignments() {
  const { data } = await api.get(apiPaths.assignments.teacherList);
  return data || [];
}

export async function fetchCourseAssignments(courseId) {
  const { data } = await api.get(apiPaths.assignments.course(courseId));
  return data || [];
}

export async function createAssignment(payload) {
  const { data } = await api.post(apiPaths.assignments.create, payload);
  return data;
}

export async function updateAssignment(id, payload) {
  const { data } = await api.patch(apiPaths.assignments.detail(id), payload);
  return data;
}

export async function deleteAssignment(id) {
  await api.delete(apiPaths.assignments.detail(id));
}

export async function publishAssignment(id) {
  const { data } = await api.post(apiPaths.assignments.publish(id));
  return data;
}

export async function closeAssignment(id) {
  const { data } = await api.post(apiPaths.assignments.close(id));
  return data;
}

export async function fetchAssignmentFeedback(id) {
  const { data } = await api.get(apiPaths.assignments.feedback(id));
  return data || { items: [], total: 0 };
}

export async function fetchSubmissions(id, params = {}) {
  const { data } = await api.get(apiPaths.assignments.submissions(id), { params });
  return data;
}

export async function submitAssignment(id, payload) {
  const { data } = await api.post(apiPaths.assignments.submit(id), payload);
  return data;
}

export async function fetchMySubmission(id) {
  const { data } = await api.get(apiPaths.assignments.mySubmission(id));
  return data;
}
