import { api, apiPaths } from "@/lib/api";

export async function fetchFiles() {
  const { data } = await api.get(apiPaths.files.list);
  return data;
}

export async function fetchFileById(id) {
  const { data } = await api.get(apiPaths.files.detail(id));
  return data;
}

export async function downloadFile(id) {
  const response = await api.get(apiPaths.files.download(id), {
    responseType: "blob"
  });
  return response.data;
}