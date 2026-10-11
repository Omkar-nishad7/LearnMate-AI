import { api, apiPaths } from "@/lib/api";

export async function fetchNotifications() {
  const { data } = await api.get(apiPaths.notifications.list);
  return data;
}

export async function fetchUnreadCount() {
  const { data } = await api.get(apiPaths.notifications.unreadCount);
  return data;
}

export async function markNotificationRead(id) {
  const { data } = await api.post(apiPaths.notifications.read(id));
  return data;
}

export async function markAllNotificationsRead() {
  const { data } = await api.post(apiPaths.notifications.readAll);
  return data;
}

export async function deleteNotification(id) {
  const { data } = await api.delete(apiPaths.notifications.remove(id));
  return data;
}