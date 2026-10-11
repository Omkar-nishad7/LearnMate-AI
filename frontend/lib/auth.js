import { api, apiPaths } from "./api";
import { STORAGE_KEYS } from "./constants";

function setCookie(name, value, days = 7) {
  if (typeof document === "undefined") return;

  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);

  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}

function removeCookie(name) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
}

export const session = {
  get access() {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEYS.ACCESS);
  },
  get refresh() {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEYS.REFRESH);
  },
  get user() {
    if (typeof window === "undefined") return null;
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.USER) || "null");
    } catch {
      return null;
    }
  },
  save({ access_token, refresh_token, user }) {
    if (typeof window === "undefined") return;

    localStorage.setItem(STORAGE_KEYS.ACCESS, access_token);
    localStorage.setItem(STORAGE_KEYS.REFRESH, refresh_token);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));

    setCookie(STORAGE_KEYS.ACCESS, access_token);
    setCookie(STORAGE_KEYS.REFRESH, refresh_token);
  },
  clear() {
    if (typeof window === "undefined") return;

    localStorage.removeItem(STORAGE_KEYS.ACCESS);
    localStorage.removeItem(STORAGE_KEYS.REFRESH);
    localStorage.removeItem(STORAGE_KEYS.USER);

    removeCookie(STORAGE_KEYS.ACCESS);
    removeCookie(STORAGE_KEYS.REFRESH);
  }
};

export async function login(payload) {
  const { data } = await api.post(apiPaths.auth.login, payload);

  session.save({
    access_token: data.tokens.access_token,
    refresh_token: data.tokens.refresh_token,
    user: data.user
  });

  return data;
}

export async function register(payload) {
  const { data } = await api.post(apiPaths.auth.register, payload);
  return data;
}

export async function logout() {
  try {
    await api.post(apiPaths.auth.logout);
  } finally {
    session.clear();
  }
}

export async function getCurrentUser() {
  const { data } = await api.get(apiPaths.auth.me);
  return data;
}

export async function refreshToken() {
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