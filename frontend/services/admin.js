import { api } from "@/lib/api";

const unwrap = async (promise) => (await promise).data;

export const fetchAdminOverview = () => unwrap(api.get("/admin/overview"));
export const fetchAdminUsers = (params = {}) => unwrap(api.get("/admin/users", { params }));
export const updateAdminUser = (id, payload) => unwrap(api.patch(`/admin/users/${id}`, payload));
export const fetchPendingTeachers = () => unwrap(api.get("/admin/teachers/pending"));
export const fetchAdminCourses = (params = {}) => unwrap(api.get("/admin/courses", { params }));
export const updateAdminCourseStatus = (id, status) => unwrap(api.patch(`/admin/courses/${id}/status`, { status }));
export const fetchAdminAIUsage = (params = {}) => unwrap(api.get("/admin/ai-usage", { params }));
export const fetchAdminAnalytics = (params = {}) => unwrap(api.get("/admin/analytics", { params }));
export const fetchAdminContent = () => unwrap(api.get("/admin/content"));
export const fetchAdminFiles = (params = {}) => unwrap(api.get("/admin/files", { params }));
export const deleteAdminFile = (id) => api.delete(`/admin/files/${id}`);
export const createAdminAnnouncement = (payload) => unwrap(api.post("/admin/announcements", payload));
export const fetchAdminActivity = (params = {}) => unwrap(api.get("/admin/activity-logs", { params }));
export const fetchAdminSettings = () => unwrap(api.get("/admin/settings"));
export const fetchAdminSearch = (q) => unwrap(api.get("/admin/search", { params: { q } }));
