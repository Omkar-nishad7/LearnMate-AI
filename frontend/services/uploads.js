import { api, apiPaths } from "@/lib/api";

export async function uploadFile(file, { category = "document", isPublic = false } = {}) {
  const form = new FormData();
  form.append("file", file);
  form.append("category", category);
  form.append("is_public", String(isPublic));
  const { data } = await api.post(apiPaths.files.list, form);
  return data;
}

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
    responseType: "blob",
  });
  return response.data;
}

export async function deleteFile(id) {
  await api.delete(apiPaths.files.detail(id));
}
