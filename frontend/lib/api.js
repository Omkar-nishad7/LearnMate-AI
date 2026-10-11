const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL || "/api/v1"
).replace(/\/$/, "");

function buildUrl(path, params) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const combined = `${API_BASE_URL}${cleanPath}`;

  // In Docker/Nginx, API_BASE_URL is relative (/api/v1), so keep the request
  // same-origin. In local Next.js development it may be an absolute URL.
  const url = combined.startsWith("/")
    ? new URL(combined, window.location.origin)
    : new URL(combined);

  if (params && typeof params === "object") {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return url;
}

function saveRefreshedTokens(data) {
  if (typeof window === "undefined" || !data?.access_token) return;

  localStorage.setItem("lm_access", data.access_token);
  if (data.refresh_token) {
    localStorage.setItem("lm_refresh", data.refresh_token);
    document.cookie = `lm_refresh=${encodeURIComponent(data.refresh_token)}; path=/; SameSite=Lax`;
  }
  document.cookie = `lm_access=${encodeURIComponent(data.access_token)}; path=/; SameSite=Lax`;
}

function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("lm_access");
  localStorage.removeItem("lm_refresh");
  localStorage.removeItem("lm_user");
  document.cookie =
    "lm_access=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax";
  document.cookie =
    "lm_refresh=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax";
}

async function parseResponse(res, responseType) {
  if (responseType === "blob") return await res.blob();

  // DELETE endpoints may legitimately return 204 No Content.
  // Never call res.json() on an empty response body.
  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return null;
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const text = await res.text();
    if (!text.trim()) return null;

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  const text = await res.text();
  return text || null;
}

async function request(
  method,
  path,
  { body, params, headers = {}, responseType } = {},
  allowRefresh = true,
) {
  const url = buildUrl(path, params);
  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;

  const finalHeaders = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...headers,
  };

  const token =
    typeof window !== "undefined" ? localStorage.getItem("lm_access") : null;

  if (token && !finalHeaders.Authorization) {
    finalHeaders.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url.toString(), {
    method,
    headers: finalHeaders,
    body:
      body === undefined || body === null
        ? undefined
        : isFormData
          ? body
          : JSON.stringify(body),
  });

  // Access tokens are short-lived. Rotate the refresh token once and retry
  // the original request, avoiding an infinite refresh loop.
  if (res.status === 401 && allowRefresh && typeof window !== "undefined") {
    const refreshToken = localStorage.getItem("lm_refresh");

    if (refreshToken && path !== "/auth/refresh") {
      try {
        const refreshUrl = buildUrl("/auth/refresh");
        const refreshResponse = await fetch(refreshUrl.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          saveRefreshedTokens(refreshData);
          return request(
            method,
            path,
            { body, params, headers, responseType },
            false,
          );
        }
      } catch {
        // Fall through to the original 401 error below.
      }

      clearSession();
    }
  }

  const data = await parseResponse(res, responseType);

  if (!res.ok) {
    const rawMessage = data?.detail ?? data?.message ?? data?.error;
    const message =
      typeof rawMessage === "object" && rawMessage !== null
        ? rawMessage.message || rawMessage.detail || rawMessage.error || JSON.stringify(rawMessage)
        : rawMessage || `Request failed (${res.status})`;

    throw Object.assign(new Error(message), {
      status: res.status,
      data,
    });
  }

  return { data };
}

export const api = {
  get: (path, config = {}) => request("GET", path, config),
  post: (path, body, config = {}) => request("POST", path, { ...config, body }),
  put: (path, body, config = {}) => request("PUT", path, { ...config, body }),
  patch: (path, body, config = {}) =>
    request("PATCH", path, { ...config, body }),
  delete: (path, config = {}) => request("DELETE", path, config),
};

export const apiPaths = {
  search: {
    all: "/search",
    youtubeChannel: (id) => `/search/youtube/channels/${id}`,
  },
  auth: {
    login: "/auth/login",
    register: "/auth/register",
    me: "/auth/me",
    logout: "/auth/logout",
    refresh: "/auth/refresh",
    verifyEmail: "/auth/verify-email",
    resendVerification: "/auth/resend-verification",
  },
  users: { me: "/users/me" },
  teacher: {
    youtubeChannel: "/teacher/youtube-channel",
  },
  teachers: {
    profile: (id) => `/teachers/${id}`,
  },
  courses: {
    list: "/courses",
    detail: (id) => `/courses/${id}`,
    videos: (id) => `/courses/${id}/videos`,

    // Teacher course management
    teacherList: "/teacher/courses",
    teacherDetail: (id) => `/teacher/courses/${id}`,
    teacherVideos: (id) => `/teacher/courses/${id}/videos`,
    publish: (id) => `/teacher/courses/${id}/publish`,
    archive: (id) => `/teacher/courses/${id}/archive`,
    unarchive: (id) => `/teacher/courses/${id}/unarchive`,
    students: (id) => `/teacher/courses/${id}/students`,

    // Course structure management
    modules: (courseId) => `/teacher/courses/${courseId}/modules`,
    module: (moduleId) => `/teacher/courses/modules/${moduleId}`,
    lessons: (moduleId) => `/teacher/courses/modules/${moduleId}/lessons`,
    lesson: (lessonId) => `/teacher/courses/lessons/${lessonId}`,

    // Student enrollment
    myEnrollments: "/student/enrollments",
    enroll: (id) => `/student/courses/${id}/enroll`,
  },
  ai: {
    tutor: "/ai/tutor",
    tutorConversations: "/ai/tutor/conversations",
    tutorConversation: (id) => `/ai/tutor/conversations/${id}`,
    summarize: "/ai/summarize",
    generateNotes: "/ai/generate-notes",
    generateQuiz: "/ai/generate-quiz",
    usage: "/ai/usage",
  },
  notes: {
    list: "/notes",
    create: "/notes",
    detail: (id) => `/notes/${id}`,
    versions: (id) => `/notes/${id}/versions`,
  },
  quizzes: {
    mine: "/quizzes/mine",
    teacher: "/quizzes/teacher",
    detail: (id) => `/quizzes/${id}`,
    start: (id) => `/quizzes/${id}/attempts`,
    submitAttempt: (id) => `/quizzes/attempts/${id}/submit`,
    attempt: (id) => `/quizzes/attempts/${id}`,
  },
  files: {
    list: "/files",
    detail: (id) => `/files/${id}`,
    download: (id) => `/files/${id}/download`,
  },
  progress: {
    lesson: (lessonId) => `/progress/lessons/${lessonId}`,
    completeLesson: (lessonId) => `/progress/lessons/${lessonId}/complete`,
    video: (videoId) => `/progress/videos/${videoId}`,
    course: (courseId) => `/progress/courses/${courseId}`,
  },
  notifications: {
    list: "/notifications",
    courseAnnouncements: "/notifications/course-announcements",
    unreadCount: "/notifications/unread-count",
    read: (id) => `/notifications/${id}/read`,
    readAll: "/notifications/read-all",
    remove: (id) => `/notifications/${id}`,
  },
  assignments: {
    list: "/assignments",
    create: "/assignments",
    teacherList: "/assignments/teacher",
    teacherDetail: (id) => `/assignments/teacher/${id}`,
    course: (courseId) => `/assignments/course/${courseId}`,
    detail: (id) => `/assignments/${id}`,
    feedback: (id) => `/assignments/${id}/feedback`,
    submissions: (id) => `/assignments/${id}/submissions`,
    publish: (id) => `/assignments/${id}/publish`,
    close: (id) => `/assignments/${id}/close`,
    submit: (id) => `/assignments/${id}/submit`,
    mySubmission: (id) => `/assignments/${id}/my-submission`,
  },
  videos: {
    list: "/videos",
    saved: "/videos/saved",
    create: "/videos",
    upload: "/videos/upload",
    detail: (id) => `/videos/${id}`,
    update: (id) => `/videos/${id}`,
    remove: (id) => `/videos/${id}`,
    state: (id) => `/videos/${id}/state`,
    save: (id) => `/videos/${id}/save`,
    status: (id) => `/videos/${id}/status`,
    reprocess: (id) => `/videos/${id}/reprocess`,
  },
  exports: {
    notes: "/exports/notes",
    quizResults: "/exports/quiz-results",
  },
  analytics: { student: "/analytics/student", teacher: "/analytics/teacher" },
};
