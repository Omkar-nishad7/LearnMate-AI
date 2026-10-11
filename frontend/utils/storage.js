export function getStorageItem(key, fallback = null) {
  if (typeof window === "undefined") return fallback;
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

export function setStorageItem(key, value) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    return;
  }
}

export function removeStorageItem(key) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    return;
  }
}