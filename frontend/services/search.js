import { api, apiPaths } from "@/lib/api";

export async function searchContent(q) {
  const { data } = await api.get(apiPaths.search.all, { params: { q } });
  return data;
}

export async function fetchYouTubeChannel(channelId) {
  const { data } = await api.get(apiPaths.search.youtubeChannel(channelId));
  return data;
}

export async function fetchTeacherYouTubeChannel() {
  const { data } = await api.get(apiPaths.teacher.youtubeChannel);
  return data;
}

export async function linkTeacherYouTubeChannel(channel) {
  const { data } = await api.put(apiPaths.teacher.youtubeChannel, { channel });
  return data;
}

export async function unlinkTeacherYouTubeChannel() {
  await api.delete(apiPaths.teacher.youtubeChannel);
}
