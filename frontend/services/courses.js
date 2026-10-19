import { api, apiPaths } from "@/lib/api";

export async function fetchCourses(params = {}) {
  const { data } = await api.get(apiPaths.courses.list, { params });
  return data;
}

export async function fetchAllCourses(params = {}) {
  const pageSize = 100;
  let page = 1;
  let pages = 1;
  const items = [];
  do {
    const data = await fetchCourses({ ...params, page, page_size: pageSize });
    items.push(...(data?.items || []));
    pages = Number(data?.pages || 1);
    page += 1;
  } while (page <= pages);
  return { items, total: items.length, page: 1, page_size: items.length || pageSize, pages: 1 };
}

export async function fetchCourseById(id) {
  const { data } = await api.get(apiPaths.courses.detail(id));
  return data;
}

export async function fetchCourseVideos(id) {
  const { data } = await api.get(apiPaths.courses.videos(id));
  return data || [];
}

export async function fetchTeacherCourses(params = {}) {
  const { data } = await api.get(apiPaths.courses.teacherList, { params });
  return data;
}

export async function fetchTeacherAllCourses(params = {}) {
  const pageSize = 100;
  let page = 1;
  let pages = 1;
  const items = [];
  do {
    const data = await fetchTeacherCourses({ ...params, page, page_size: pageSize });
    items.push(...(data?.items || []));
    pages = Number(data?.pages || 1);
    page += 1;
  } while (page <= pages);
  return { items, total: items.length, page: 1, page_size: items.length || pageSize, pages: 1 };
}

export async function fetchTeacherCourseById(id) {
  const { data } = await api.get(apiPaths.courses.teacherDetail(id));
  return data;
}

export async function fetchTeacherCourseVideos(id) {
  const { data } = await api.get(apiPaths.courses.teacherVideos(id));
  return data || [];
}

export async function createCourse(payload) {
  const { data } = await api.post(apiPaths.courses.teacherList, payload);
  return data;
}

export async function updateCourse(id, payload) {
  const { data } = await api.patch(apiPaths.courses.teacherDetail(id), payload);
  return data;
}

export async function deleteCourse(id) {
  await api.delete(apiPaths.courses.teacherDetail(id));
  return true;
}

export async function publishCourse(id) {
  const { data } = await api.post(apiPaths.courses.publish(id));
  return data;
}

export async function archiveCourse(id) {
  const { data } = await api.post(apiPaths.courses.archive(id));
  return data;
}

export async function unarchiveCourse(id) {
  const { data } = await api.post(apiPaths.courses.unarchive(id));
  return data;
}

export async function createModule(courseId, payload) {
  const { data } = await api.post(apiPaths.courses.modules(courseId), payload);
  return data;
}

export async function updateModule(moduleId, payload) {
  const { data } = await api.patch(apiPaths.courses.module(moduleId), payload);
  return data;
}

export async function deleteModule(moduleId) {
  await api.delete(apiPaths.courses.module(moduleId));
  return true;
}

export async function createLesson(moduleId, payload) {
  const { data } = await api.post(apiPaths.courses.lessons(moduleId), payload);
  return data;
}

export async function updateLesson(lessonId, payload) {
  const { data } = await api.patch(apiPaths.courses.lesson(lessonId), payload);
  return data;
}

export async function deleteLesson(lessonId) {
  await api.delete(apiPaths.courses.lesson(lessonId));
  return true;
}

export async function fetchMyEnrollments() {
  // The API paginates enrollment rows. Collect all pages so the student
  // catalog does not silently omit courses beyond the first 20 results.
  const pageSize = 100;
  const items = [];
  let page = 1;

  while (page <= 1000) {
    const { data } = await api.get(apiPaths.courses.myEnrollments, {
      params: { page, page_size: pageSize },
    });
    const currentPage = Array.isArray(data) ? data : [];
    items.push(...currentPage);
    if (currentPage.length < pageSize) break;
    page += 1;
  }

  return items;
}

export async function enrollCourse(courseId) {
  const { data } = await api.post(apiPaths.courses.enroll(courseId));
  return data;
}

export async function unenrollCourse(courseId) {
  const { data } = await api.delete(apiPaths.courses.enroll(courseId));
  return data;
}
