import { api, apiPaths } from "@/lib/api";

export async function fetchNotes(params = {}) {
  const { data } = await api.get(apiPaths.notes.list, { params });
  return data;
}

export async function createNote(payload) {
  const { data } = await api.post(apiPaths.notes.create, payload);
  return data;
}

export async function fetchNoteById(id) {
  const { data } = await api.get(apiPaths.notes.detail(id));
  return data;
}

export async function updateNote(id, payload) {
  const { data } = await api.patch(apiPaths.notes.detail(id), payload);
  return data;
}

export async function deleteNote(id) {
  const { data } = await api.delete(apiPaths.notes.detail(id));
  return data;
}

export async function fetchNoteVersions(id) {
  const { data } = await api.get(apiPaths.notes.versions(id));
  return data;
}