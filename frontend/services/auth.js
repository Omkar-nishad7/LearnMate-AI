import { api, apiPaths } from "@/lib/api";
import { session } from "@/lib/auth";

export async function loginUser(payload) {
  const { data } = await api.post(apiPaths.auth.login, payload);

  if (data?.tokens) {
    session.save({
      access_token: data.tokens.access_token,
      refresh_token: data.tokens.refresh_token,
      user: data.user
    });
  }

  return data;
}

export async function registerUser(payload) {
  const { data } = await api.post(apiPaths.auth.register, payload);

  if (data?.tokens) {
    session.save({
      access_token: data.tokens.access_token,
      refresh_token: data.tokens.refresh_token,
      user: data.user,
    });
  }

  return data;
}

export async function fetchMe() {
  const { data } = await api.get(apiPaths.auth.me);
  return data;
}

export async function logoutUser() {
  try {
    await api.post(apiPaths.auth.logout);
  } finally {
    session.clear();
  }
}

export async function refreshAuthToken() {
  const refresh_token = session.refresh;
  if (!refresh_token) return null;

  const { data } = await api.post(apiPaths.auth.refresh, { refresh_token });

  session.save({
    access_token: data.access_token,
    refresh_token: data.refresh_token || refresh_token,
    user: session.user
  });

  return data;
}