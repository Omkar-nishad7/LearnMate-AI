import { api, apiPaths } from "@/lib/api";

export async function fetchVideos(params = {}) {
  const { data } = await api.get(apiPaths.videos.list, { params });
  return data;
}

export async function fetchSavedVideos(params = {}) {
  const { data } = await api.get(apiPaths.videos.saved, { params });
  return data;
}

export async function importYouTubeVideo(payload) {
  const { data } = await api.post(apiPaths.videos.create, payload);
  return data;
}

export async function uploadCourseVideo(file, lessonId) {
  const form = new FormData();
  form.append("file", file);
  if (lessonId) form.append("lesson_id", String(lessonId));
  const { data } = await api.post(apiPaths.videos.upload, form);
  return data;
}

export async function fetchVideoById(id) {
  const { data } = await api.get(apiPaths.videos.detail(id));
  return data;
}

export async function fetchVideoStatus(id) {
  const { data } = await api.get(apiPaths.videos.status(id));
  return data;
}

export async function updateVideo(id, payload) {
  const { data } = await api.patch(apiPaths.videos.update(id), payload);
  return data;
}

export async function fetchVideoState(id) {
  const { data } = await api.get(apiPaths.videos.state(id));
  return data;
}

export async function updateVideoState(id, payload) {
  const { data } = await api.patch(apiPaths.videos.state(id), payload);
  return data;
}

export async function saveVideoForLater(id) {
  const { data } = await api.post(apiPaths.videos.save(id));
  return data;
}

export async function removeVideoFromLater(id) {
  const { data } = await api.delete(apiPaths.videos.save(id));
  return data;
}

export async function reprocessVideo(id) {
  const { data } = await api.post(apiPaths.videos.reprocess(id));
  return data;
}

export async function retryVideoTranscript(id) {
  const { data } = await api.post(apiPaths.videos.retryTranscript(id));
  return data;
}


export async function deleteVideo(id) {
  await api.delete(apiPaths.videos.remove(id));
  return true;
}
