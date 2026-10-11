import { api, apiPaths } from "@/lib/api";

export async function fetchMyUser() {
  const { data } = await api.get(apiPaths.users.me);
  return data;
}

export async function updateMyUser(payload) {
  const { data } = await api.patch(apiPaths.users.me, payload);
  return data;
}