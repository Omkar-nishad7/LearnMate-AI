"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckSquare,
  ChevronDown,
  ClipboardList,
  Download,
  Eye,
  FileText,
  Filter,
  Grid2X2,
  Layers3,
  List,
  Loader2,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import Card from "@/components/ui/Card";
import {
  deleteVideo,
  fetchVideos,
  importYouTubeVideo,
  uploadCourseVideo,
} from "@/services/videos";
import { fetchTeacherAssignments } from "@/services/assignments";
import {
  fetchTeacherAllCourses,
  fetchTeacherCourseById,
} from "@/services/courses";
import {
  createNote,
  deleteNote,
  fetchNotes,
  updateNote,
} from "@/services/notes";
import {
  fetchTeacherQuizzes,
  fetchTeacherQuizById,
  generateQuizFromVideo,
  publishTeacherQuiz,
} from "@/services/quiz";
import {
  generateNotesFromVideo,
  generateTeacherAssignment,
} from "@/services/ai";
import {
  createCourseResource,
  deleteCourseResource,
  fetchTeacherResources,
  resolveCourseResourceUrl,
} from "@/services/courseResources";
import { deleteFile, uploadFile } from "@/services/uploads";

const TABS = [
  "All Content",
  "Notes",
  "Videos",
  "Quizzes",
  "Assignments",
  "Flashcards",
  "Resources",
];
const cardInput = "input-ui w-full";

function messageFor(error, fallback) {
  const detail = error?.data?.detail;
  if (detail && typeof detail === "object")
    return detail.message || detail.detail || fallback;
  return error?.message || detail || fallback;
}

function dateLabel(value) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}

function itemsFrom(value) {
  return Array.isArray(value)
    ? value
    : Array.isArray(value?.items)
      ? value.items
      : [];
}

function toSafeCourseId(value) {
  return value ? Number(value) : null;
}

export default function TeacherContentStudioPage() {
  const [videos, setVideos] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [notes, setNotes] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [resources, setResources] = useState([]);
  const [activeTab, setActiveTab] = useState("All Content");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [view, setView] = useState("list");
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [dialog, setDialog] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedCourseDetail, setSelectedCourseDetail] = useState(null);
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [resourceFile, setResourceFile] = useState(null);
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceDescription, setResourceDescription] = useState("");
  const [noteForm, setNoteForm] = useState({
    id: null,
    title: "",
    content: "",
    course_id: "",
    video_id: "",
    mode: "write",
    share_with_students: true,
  });
  const [quizForm, setQuizForm] = useState({
    course_id: "",
    video_id: "",
    num_questions: 5,
  });
  const [quizDetail, setQuizDetail] = useState(null);
  const [flashcardForm, setFlashcardForm] = useState({
    title: "",
    course_id: "",
    cards: [{ front: "", back: "" }],
  });
  const [viewItem, setViewItem] = useState(null);
  const [assignmentForm, setAssignmentForm] = useState({
    topic: "",
    course_id: "",
    difficulty: "intermediate",
    audience: "undergraduate students",
    notes: "",
  });
  const [generatedAssignment, setGeneratedAssignment] = useState(null);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    setError("");
    const results = await Promise.allSettled([
      fetchVideos(),
      fetchTeacherAssignments(),
      fetchTeacherAllCourses(),
      fetchNotes({ page: 1, page_size: 100 }),
      fetchTeacherQuizzes(),
      fetchTeacherResources(),
    ]);
    const setters = [
      setVideos,
      setAssignments,
      setCourses,
      setNotes,
      setQuizzes,
      setResources,
    ];
    let failures = 0;
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        const value = result.value;
        if (
          index === 0 ||
          index === 1 ||
          index === 2 ||
          index === 4 ||
          index === 5
        )
          setters[index](itemsFrom(value));
        else setters[index](itemsFrom(value));
      } else {
        failures += 1;
        // Keep the rest of the studio usable when one optional content type has an issue.
        if (index === 0) setVideos([]);
        if (index === 1) setAssignments([]);
        if (index === 2) setCourses([]);
        if (index === 3) setNotes([]);
        if (index === 4) setQuizzes([]);
        if (index === 5) setResources([]);
      }
    });
    if (failures === results.length)
      setError("Content could not be loaded. Please refresh and try again.");
    else if (failures)
      setNotice(
        "Some content types could not be loaded. Available content is still shown.",
      );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function selectCourse(courseId) {
    setSelectedCourseId(courseId);
    setSelectedLessonId("");
    setSelectedCourseDetail(null);
    if (!courseId) return;
    try {
      const detail = await fetchTeacherCourseById(courseId);
      setSelectedCourseDetail(detail);
    } catch (e) {
      setError(messageFor(e, "Unable to load this course's lessons."));
    }
  }

  function openDialog(type) {
    setError("");
    setNotice("");
    setShowCreate(false);
    setDialog(type === "ai-notes" ? "note-create" : type);
    if (type === "note-create" || type === "ai-notes")
      setNoteForm({
        id: null,
        title: "",
        content: "",
        course_id: "",
        video_id: "",
        mode: type === "ai-notes" ? "ai" : "write",
        share_with_students: true,
      });
    if (type === "quiz-create") {
      setQuizForm({ course_id: "", video_id: "", num_questions: 5 });
      setQuizDetail(null);
    }
    if (type === "flashcard-create")
      setFlashcardForm({
        title: "",
        course_id: "",
        cards: [{ front: "", back: "" }],
      });
    if (type === "resource-upload") {
      setSelectedCourseId("");
      setSelectedCourseDetail(null);
      setSelectedLessonId("");
      setResourceFile(null);
      setResourceTitle("");
      setResourceDescription("");
    }
    if (type === "video-upload") {
      setSelectedCourseId("");
      setSelectedCourseDetail(null);
      setSelectedLessonId("");
      setVideoFile(null);
      setVideoUrl("");
    }
    if (type === "assignment-ai") {
      setAssignmentForm({
        topic: assistantPrompt.trim(),
        course_id: "",
        difficulty: "intermediate",
        audience: "undergraduate students",
        notes: "",
      });
      setGeneratedAssignment(null);
    }
  }

  async function uploadVideo(event) {
    event.preventDefault();
    if (!videoFile && !videoUrl.trim())
      return setError("Choose a video file or enter a YouTube URL.");
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (videoFile)
        await uploadCourseVideo(
          videoFile,
          selectedLessonId ? Number(selectedLessonId) : undefined,
        );
      else
        await importYouTubeVideo({
          url: videoUrl.trim(),
          ...(selectedLessonId ? { lesson_id: Number(selectedLessonId) } : {}),
        });
      setDialog("");
      setVideoFile(null);
      setVideoUrl("");
      setNotice(
        selectedLessonId
          ? "Video added to the selected lesson."
          : "Video added to your content library.",
      );
      await load({ quiet: true });
    } catch (e) {
      setError(messageFor(e, "Unable to add this video."));
    } finally {
      setBusy(false);
    }
  }

  async function uploadResource(event) {
    event.preventDefault();
    if (!selectedCourseId || !resourceFile)
      return setError("Select a course and choose a resource file.");
    setBusy(true);
    setError("");
    setNotice("");
    let uploaded = null;
    try {
      const category = resourceFile.type?.startsWith("image/")
        ? "image"
        : "document";
      uploaded = await uploadFile(resourceFile, { category, isPublic: false });
      await createCourseResource(selectedCourseId, {
        file_id: uploaded.id,
        title: resourceTitle.trim() || resourceFile.name,
        description: resourceDescription.trim() || null,
        lesson_id: selectedLessonId ? Number(selectedLessonId) : null,
        resource_type: category === "image" ? "image" : "document",
      });
      setDialog("");
      setResourceFile(null);
      setNotice("Resource uploaded and attached to the selected course.");
      await load({ quiet: true });
    } catch (e) {
      if (uploaded?.id) {
        try {
          await deleteFile(uploaded.id);
        } catch (_) {
          /* Keep file in library if cleanup fails. */
        }
      }
      setError(messageFor(e, "Unable to upload this resource."));
    } finally {
      setBusy(false);
    }
  }

  async function shareTextAsCourseResource(courseId, title, markdown) {
    if (!courseId || !markdown?.trim()) return;
    const safeName =
      String(title || "course-notes")
        .replace(/[^a-z0-9-_]+/gi, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80) || "course-notes";
    const file = new File([markdown], `${safeName}.md`, {
      type: "text/markdown;charset=utf-8",
    });
    const uploaded = await uploadFile(file, {
      category: "document",
      isPublic: false,
    });
    try {
      await createCourseResource(courseId, {
        file_id: uploaded.id,
        title: String(title || "Course notes").slice(0, 300),
        description: "Notes created in LearnMate AI Content Studio",
        resource_type: "document",
      });
    } catch (error) {
      try {
        await deleteFile(uploaded.id);
      } catch (_) {
        /* Keep a file in the library if cleanup fails. */
      }
      throw error;
    }
  }

  async function saveNote(event) {
    event.preventDefault();
    if (!noteForm.title.trim() || !noteForm.content.trim())
      return setError("Enter both a note title and note content.");
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        title: noteForm.title.trim(),
        content: noteForm.content.trim(),
        course_id: toSafeCourseId(noteForm.course_id),
        ...(noteForm.video_id ? { video_id: Number(noteForm.video_id) } : {}),
      };
      if (noteForm.id) {
        await updateNote(noteForm.id, payload);
        setNotice("Note updated successfully.");
      } else {
        const saved = await createNote(payload);
        if (noteForm.share_with_students && payload.course_id) {
          try {
            await shareTextAsCourseResource(
              payload.course_id,
              payload.title,
              payload.content,
            );
            setNotice(
              "Note saved and attached to the course for enrolled students.",
            );
          } catch (shareError) {
            setNotice(
              `Note saved, but could not attach the downloadable course copy: ${messageFor(shareError, "resource upload failed")}`,
            );
          }
        } else {
          setNotice("Note saved to your content library.");
        }
      }
      setDialog("");
      await load({ quiet: true });
    } catch (e) {
      setError(messageFor(e, "Unable to save this note."));
    } finally {
      setBusy(false);
    }
  }

  async function generateNotes(event) {
    event.preventDefault();
    if (!noteForm.video_id)
      return setError("Choose a teaching video before generating AI notes.");
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await generateNotesFromVideo({
        video_id: Number(noteForm.video_id),
        course_id: toSafeCourseId(noteForm.course_id),
      });
      let noticeText = `AI notes “${result.title || "Untitled notes"}” were generated and saved.`;
      if (
        noteForm.share_with_students &&
        noteForm.course_id &&
        result.content
      ) {
        try {
          await shareTextAsCourseResource(
            Number(noteForm.course_id),
            result.title || "AI course notes",
            result.content,
          );
          noticeText =
            "AI notes were generated and attached to the course for enrolled students.";
        } catch (shareError) {
          noticeText = `AI notes were saved, but the downloadable course copy could not be attached: ${messageFor(shareError, "resource upload failed")}`;
        }
      }
      setDialog("");
      setNotice(noticeText);
      await load({ quiet: true });
    } catch (e) {
      setError(
        messageFor(
          e,
          "Unable to generate notes. The selected video may not have an available transcript yet.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function generateQuiz(event) {
    event.preventDefault();
    if (!quizForm.course_id || !quizForm.video_id)
      return setError("Select both a course and a source video for the quiz.");
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await generateQuizFromVideo({
        course_id: Number(quizForm.course_id),
        video_id: Number(quizForm.video_id),
        num_questions: Number(quizForm.num_questions),
      });
      let detail = result;
      try {
        detail = await fetchTeacherQuizById(result.id);
      } catch (_) {
        /* Show the generated quiz summary if author detail is temporarily unavailable. */
      }
      setQuizDetail(detail);
      setDialog("quiz-preview");
      setNotice(
        "Quiz generated as a draft. Review the questions and publish it when ready.",
      );
      await load({ quiet: true });
    } catch (e) {
      setError(
        messageFor(
          e,
          "Unable to generate the quiz. Make sure the selected video has usable content.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function publishQuiz(quizId) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await publishTeacherQuiz(quizId);
      const refreshed = await fetchTeacherQuizById(quizId).catch(
        () => quizDetail,
      );
      setQuizDetail(refreshed);
      setNotice("Quiz published for students enrolled in its course.");
      await load({ quiet: true });
    } catch (e) {
      setError(
        messageFor(
          e,
          "Unable to publish this quiz. Check that it contains at least one question.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  function addFlashcard() {
    setFlashcardForm((form) => ({
      ...form,
      cards: [...form.cards, { front: "", back: "" }],
    }));
  }
  function updateFlashcard(index, key, value) {
    setFlashcardForm((form) => ({
      ...form,
      cards: form.cards.map((card, i) =>
        i === index ? { ...card, [key]: value } : card,
      ),
    }));
  }
  async function saveFlashcards(event) {
    event.preventDefault();
    const cards = flashcardForm.cards.map((card) => ({
      front: card.front.trim(),
      back: card.back.trim(),
    }));
    if (!flashcardForm.title.trim())
      return setError("Enter a title for this flashcard set.");
    if (!cards.length || cards.some((card) => !card.front || !card.back))
      return setError("Complete the front and back of every flashcard.");
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const courseId = toSafeCourseId(flashcardForm.course_id);
      await createNote({
        title: flashcardForm.title.trim(),
        content: `Flashcard set with ${cards.length} cards.`,
        course_id: courseId,
        tags: { content_type: "flashcards", cards },
      });
      let noticeText = "Flashcard set saved to your content library.";
      if (courseId) {
        const markdown = `# ${flashcardForm.title.trim()}\n\n${cards.map((card, index) => `## Card ${index + 1}\n\n**Front:** ${card.front}\n\n**Back:** ${card.back}`).join("\n\n---\n\n")}`;
        try {
          await shareTextAsCourseResource(
            courseId,
            flashcardForm.title.trim(),
            markdown,
          );
          noticeText =
            "Flashcards saved and attached to the course as downloadable study material.";
        } catch (shareError) {
          noticeText = `Flashcards saved, but their course download could not be attached: ${messageFor(shareError, "resource upload failed")}`;
        }
      }
      setDialog("");
      setNotice(noticeText);
      await load({ quiet: true });
    } catch (e) {
      setError(messageFor(e, "Unable to save the flashcards."));
    } finally {
      setBusy(false);
    }
  }

  async function generateAssignment(event) {
    event.preventDefault();
    if (!assignmentForm.topic.trim())
      return setError("Enter a topic for the AI assignment.");
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await generateTeacherAssignment({
        topic: assignmentForm.topic.trim(),
        difficulty: assignmentForm.difficulty,
        audience: assignmentForm.audience,
        notes: assignmentForm.notes,
      });
      setGeneratedAssignment(result);
      setNotice(
        "AI assignment draft generated. Review it before opening the assignment builder.",
      );
    } catch (e) {
      setError(messageFor(e, "Unable to generate an assignment draft."));
    } finally {
      setBusy(false);
    }
  }

  function useGeneratedAssignment() {
    if (!generatedAssignment || !assignmentForm.course_id)
      return setError(
        "Select the course for this assignment before continuing.",
      );
    try {
      window.sessionStorage.setItem(
        "learnmate:generated-assignment",
        JSON.stringify({
          ...generatedAssignment,
          course_id: Number(assignmentForm.course_id),
        }),
      );
      window.location.href = "/teacher/assignments/new?from_ai=1";
    } catch (_) {
      setError(
        "Your browser could not transfer the draft. Copy the generated details before reopening the assignment editor.",
      );
    }
  }

  async function removeItem(item) {
    const kind = item._kind;
    if (!window.confirm(`Delete “${item._title}”? This cannot be undone.`))
      return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (kind === "Video") {
        await deleteVideo(item.id);
        setVideos((old) =>
          old.filter((entry) => String(entry.id) !== String(item.id)),
        );
      } else if (kind === "Note" || kind === "Flashcards")
        await deleteNote(item.id);
      else if (kind === "Resource")
        await deleteCourseResource(item.course_id, item.id);
      else if (kind === "Quiz")
        return setError(
          "Quizzes are not deleted from Content Studio. Open the quiz to review its draft or publish it.",
        );
      else if (kind === "Assignment")
        return setError(
          "Assignments are managed from the Assignments workspace.",
        );
      setNotice(`${kind} deleted or removed successfully.`);
      await load({ quiet: true });
    } catch (e) {
      setError(messageFor(e, `Unable to delete this ${kind.toLowerCase()}.`));
    } finally {
      setBusy(false);
    }
  }

  async function viewQuiz(quiz) {
    setBusy(true);
    setError("");
    try {
      setQuizDetail(await fetchTeacherQuizById(quiz.id));
      setDialog("quiz-preview");
    } catch (e) {
      setError(messageFor(e, "Unable to open quiz details."));
    } finally {
      setBusy(false);
    }
  }

  function runAssistant(event) {
    event.preventDefault();
    const prompt = assistantPrompt.trim();
    if (!prompt) return setError("Describe what you want to create first.");
    const lower = prompt.toLowerCase();
    if (lower.includes("assignment")) {
      setAssignmentForm((f) => ({ ...f, topic: prompt }));
      openDialog("assignment-ai");
      return;
    }
    if (lower.includes("quiz") || lower.includes("question")) {
      openDialog("quiz-create");
      return;
    }
    if (lower.includes("note")) {
      openDialog(
        lower.includes("ai") || lower.includes("generate")
          ? "ai-notes"
          : "note-create",
      );
      return;
    }
    if (lower.includes("flashcard")) {
      openDialog("flashcard-create");
      return;
    }
    if (
      lower.includes("pdf") ||
      lower.includes("resource") ||
      lower.includes("document")
    ) {
      openDialog("resource-upload");
      return;
    }
    if (lower.includes("video") || lower.includes("lecture")) {
      openDialog("video-upload");
      return;
    }
    if (lower.includes("course")) {
      window.location.href = "/teacher/courses/new";
      return;
    }
    setError(
      "Choose a content type such as video, PDF resource, notes, quiz, flashcards, or assignment.",
    );
  }

  const content = useMemo(() => {
    const courseName = (id) =>
      courses.find((course) => String(course.id) === String(id))?.title ||
      "Course resource";
    const videoItems = videos.map((item) => ({
      ...item,
      _kind: "Video",
      _title: item.title || `Video #${item.id}`,
      _description: item.description || item.url || "Teaching video or lecture",
      _date: item.created_at || item.createdAt,
    }));
    const assignmentItems = assignments.map((item) => ({
      ...item,
      _kind: "Assignment",
      _title: item.title || item.name || `Assignment #${item.id}`,
      _description: item.description || "Assignment for students",
      _date: item.created_at || item.createdAt,
    }));
    const noteItems = notes
      .filter((item) => item.tags?.content_type !== "flashcards")
      .map((item) => ({
        ...item,
        _kind: "Note",
        _title: item.title || `Note #${item.id}`,
        _description: String(item.content || "").slice(0, 220),
        _date: item.created_at || item.createdAt,
      }));
    const flashcardItems = notes
      .filter((item) => item.tags?.content_type === "flashcards")
      .map((item) => ({
        ...item,
        _kind: "Flashcards",
        _title: item.title || `Flashcards #${item.id}`,
        _description: `${item.tags?.cards?.length || 0} revision cards`,
        _date: item.created_at || item.createdAt,
      }));
    const quizItems = quizzes.map((item) => ({
      ...item,
      _kind: "Quiz",
      _title: item.title || `Quiz #${item.id}`,
      _description: `${item.total_points || 0} total points · ${String(item.status || "draft").toLowerCase()}`,
      _date: item.created_at || item.createdAt,
    }));
    const resourceItems = resources.map((item) => ({
      ...item,
      _kind: "Resource",
      _title: item.title || item.original_name || `Resource #${item.id}`,
      _description: `${item.original_name || "Uploaded file"} · ${courseName(item.course_id)}`,
      _date: item.created_at || item.createdAt,
    }));
    const byKind = {
      Videos: videoItems,
      Assignments: assignmentItems,
      Notes: noteItems,
      Quizzes: quizItems,
      Flashcards: flashcardItems,
      Resources: resourceItems,
    };
    let result =
      activeTab === "All Content"
        ? [
            ...noteItems,
            ...videoItems,
            ...quizItems,
            ...assignmentItems,
            ...flashcardItems,
            ...resourceItems,
          ]
        : byKind[activeTab] || [];
    const term = search.trim().toLowerCase();
    if (term)
      result = result.filter((item) =>
        `${item._title} ${item._description} ${item._kind}`
          .toLowerCase()
          .includes(term),
      );
    result.sort((a, b) =>
      sort === "title"
        ? a._title.localeCompare(b._title)
        : (sort === "oldest" ? 1 : -1) *
          ((new Date(a._date || 0).getTime() || 0) -
            (new Date(b._date || 0).getTime() || 0)),
    );
    return result;
  }, [
    videos,
    assignments,
    courses,
    notes,
    quizzes,
    resources,
    activeTab,
    search,
    sort,
  ]);

  const counts = {
    Videos: videos.length,
    Notes: notes.filter((n) => n.tags?.content_type !== "flashcards").length,
    Quizzes: quizzes.length,
    Assignments: assignments.length,
    Flashcards: notes.filter((n) => n.tags?.content_type === "flashcards")
      .length,
    Resources: resources.length,
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <Sidebar role="teacher" />
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            title="Content Studio"
            subtitle="Create, manage and organize your teaching content"
            user={{ full_name: "Teacher", role: "Teacher" }}
          />
          <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-8">
            <div className="mx-auto max-w-7xl space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                    Content Studio{" "}
                    <Sparkles className="inline h-5 w-5 text-indigo-500" />
                  </h1>
                  <p className="mt-1 max-w-2xl text-sm text-slate-500">
                    Create, upload, edit, and organize content for your courses.
                    Choose a course when content should be available to
                    students.
                  </p>
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowCreate((value) => !value)}
                    className="btn-primary inline-flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" /> Create New Content{" "}
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  {showCreate ? (
                    <div className="absolute right-0 z-20 mt-2 w-60 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                      {[
                        ["Upload Video", "video-upload", Upload],
                        ["Upload Course Resource", "resource-upload", FileText],
                        ["Create / Generate Notes", "note-create", Sparkles],
                        ["Generate Quiz", "quiz-create", CheckSquare],
                        ["Create Flashcards", "flashcard-create", Layers3],
                        ["AI Assignment", "assignment-ai", ClipboardList],
                      ].map(([label, type, Icon]) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => openDialog(type)}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                        >
                          <Icon className="h-4 w-4 text-indigo-600" />
                          {label}
                        </button>
                      ))}
                      <Link
                        href="/teacher/courses/new"
                        onClick={() => setShowCreate(false)}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <BookOpen className="h-4 w-4 text-indigo-600" /> Create
                        Course
                      </Link>
                    </div>
                  ) : null}
                </div>
              </div>

              {error ? (
                <div
                  role="alert"
                  className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  <span>{error}</span>
                  <button
                    type="button"
                    aria-label="Dismiss error"
                    onClick={() => setError("")}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
              {notice ? (
                <div
                  role="status"
                  className="flex items-start justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800"
                >
                  <span>{notice}</span>
                  <button
                    type="button"
                    aria-label="Dismiss message"
                    onClick={() => setNotice("")}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                {[
                  {
                    label: "Upload Video",
                    desc: "Add a lecture to your library or lesson",
                    icon: Play,
                    action: () => openDialog("video-upload"),
                  },
                  {
                    label: "Upload PDF",
                    desc: "Attach notes, slides, or documents",
                    icon: FileText,
                    action: () => openDialog("resource-upload"),
                  },
                  {
                    label: "AI Notes",
                    desc: "Generate notes from a selected video or write them manually",
                    icon: Sparkles,
                    action: () => openDialog("ai-notes"),
                  },
                  {
                    label: "AI Quiz",
                    desc: "Generate a course quiz from a video",
                    icon: CheckSquare,
                    action: () => openDialog("quiz-create"),
                  },
                  {
                    label: "AI Assignment",
                    desc: "Generate a draft to finish in the editor",
                    icon: ClipboardList,
                    action: () => openDialog("assignment-ai"),
                  },
                  {
                    label: "Flashcards",
                    desc: "Create reusable front/back cards",
                    icon: Layers3,
                    action: () => openDialog("flashcard-create"),
                  },
                ].map(({ label, desc, icon: Icon, action }) => (
                  <button
                    type="button"
                    key={label}
                    onClick={action}
                    className="group rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
                  >
                    <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="block text-sm font-semibold text-slate-800">
                      {label}
                    </span>
                    <span className="mt-1 block min-h-8 text-xs text-slate-500">
                      {desc}
                    </span>
                    <ArrowRight className="mt-2 h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-indigo-600" />
                  </button>
                ))}
              </div>

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 p-3 sm:px-4">
                    {TABS.map((tab) => (
                      <button
                        type="button"
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`rounded-lg px-3 py-2 text-sm font-medium transition ${activeTab === tab ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}
                      >
                        {tab}
                        {tab !== "All Content" && counts[tab] != null ? (
                          <span className="ml-1.5 text-xs opacity-70">
                            {counts[tab]}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
                    <label className="relative min-w-0 flex-1">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="input-ui w-full pl-9"
                        placeholder="Search your content..."
                      />
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                        className="input-ui"
                      >
                        <option value="newest">Newest</option>
                        <option value="oldest">Oldest</option>
                        <option value="title">Title A–Z</option>
                      </select>
                      <button
                        type="button"
                        aria-label="Grid view"
                        onClick={() => setView("grid")}
                        className={`rounded-lg border p-2 ${view === "grid" ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500"}`}
                      >
                        <Grid2X2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="List view"
                        onClick={() => setView("list")}
                        className={`rounded-lg border p-2 ${view === "list" ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500"}`}
                      >
                        <List className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Refresh content"
                        onClick={() => load({ quiet: false })}
                        className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
                      >
                        <RefreshCw
                          className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                        />
                      </button>
                    </div>
                  </div>
                  <div
                    className={
                      view === "grid"
                        ? "grid gap-3 p-4 sm:grid-cols-2"
                        : "divide-y divide-slate-100"
                    }
                  >
                    {loading ? (
                      <div className="p-12 text-center text-sm text-slate-500">
                        <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />
                        Loading content…
                      </div>
                    ) : content.length ? (
                      content.map((item) => (
                        <article
                          key={`${item._kind}-${item.id}`}
                          className={
                            view === "grid"
                              ? "flex min-w-0 flex-col rounded-xl border border-slate-200 p-4"
                              : "flex flex-wrap items-center gap-4 p-4"
                          }
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <div
                              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${item._kind === "Video" ? "bg-blue-50 text-blue-600" : item._kind === "Resource" ? "bg-emerald-50 text-emerald-600" : item._kind === "Quiz" ? "bg-violet-50 text-violet-600" : item._kind === "Assignment" ? "bg-orange-50 text-orange-600" : "bg-indigo-50 text-indigo-600"}`}
                            >
                              {item._kind === "Video" ? (
                                <Video className="h-5 w-5" />
                              ) : item._kind === "Resource" ? (
                                <FileText className="h-5 w-5" />
                              ) : item._kind === "Quiz" ? (
                                <CheckSquare className="h-5 w-5" />
                              ) : item._kind === "Assignment" ? (
                                <ClipboardList className="h-5 w-5" />
                              ) : item._kind === "Flashcards" ? (
                                <Layers3 className="h-5 w-5" />
                              ) : (
                                <FileText className="h-5 w-5" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="truncate font-semibold text-slate-800">
                                  {item._title}
                                </h3>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                  {item._kind}
                                </span>
                                {item.status ? (
                                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                                    {String(item.status).replaceAll("_", " ")}
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                                {item._description}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">
                                Created {dateLabel(item._date)}
                              </p>
                            </div>
                          </div>
                          <div
                            className={`flex flex-wrap items-center gap-2 ${view === "grid" ? "mt-4" : ""}`}
                          >
                            {item._kind === "Video" ? (
                              <>
                                <Link
                                  href={`/teacher/videos/${item.id}`}
                                  className="btn-secondary"
                                >
                                  <Eye className="mr-1.5 h-4 w-4" />
                                  View
                                </Link>
                                <Link
                                  href={`/teacher/videos/${item.id}/edit`}
                                  className="btn-secondary"
                                >
                                  <Pencil className="mr-1.5 h-4 w-4" />
                                  Edit
                                </Link>
                              </>
                            ) : null}
                            {item._kind === "Assignment" ? (
                              <Link
                                href={`/teacher/assignments/${item.id}/edit`}
                                className="btn-secondary"
                              >
                                <Eye className="mr-1.5 h-4 w-4" />
                                View / Edit
                              </Link>
                            ) : null}
                            {item._kind === "Note" ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setNoteForm({
                                    id: item.id,
                                    title: item.title || "",
                                    content: item.content || "",
                                    course_id: item.course_id
                                      ? String(item.course_id)
                                      : "",
                                    video_id: item.video_id
                                      ? String(item.video_id)
                                      : "",
                                    mode: "write",
                                    share_with_students: false,
                                  });
                                  setDialog("note-edit");
                                }}
                                className="btn-secondary"
                              >
                                <Pencil className="mr-1.5 h-4 w-4" />
                                Edit
                              </button>
                            ) : null}
                            {item._kind === "Flashcards" ? (
                              <button
                                type="button"
                                onClick={() => setViewItem(item)}
                                className="btn-secondary"
                              >
                                <Eye className="mr-1.5 h-4 w-4" />
                                View Cards
                              </button>
                            ) : null}
                            {item._kind === "Quiz" ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => viewQuiz(item)}
                                className="btn-secondary"
                              >
                                <Eye className="mr-1.5 h-4 w-4" />
                                Review
                              </button>
                            ) : null}
                            {item._kind === "Resource" ? (
                              <a
                                href={resolveCourseResourceUrl(
                                  item.download_url,
                                )}
                                target="_blank"
                                rel="noreferrer"
                                className="btn-secondary"
                              >
                                <Download className="mr-1.5 h-4 w-4" />
                                Download
                              </a>
                            ) : null}
                            {item._kind === "Resource" ||
                            item._kind === "Video" ||
                            item._kind === "Note" ||
                            item._kind === "Flashcards" ? (
                              <button
                                type="button"
                                disabled={busy}
                                title="Delete"
                                onClick={() => removeItem(item)}
                                className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            ) : null}
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="p-12 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                          <Filter className="h-6 w-6" />
                        </div>
                        <h3 className="mt-3 font-semibold text-slate-800">
                          {search
                            ? "No matching content"
                            : `No ${activeTab === "All Content" ? "content" : activeTab.toLowerCase()} yet`}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          Create or upload items here, or attach them directly
                          from a course workspace.
                        </p>
                        <div className="mt-4 flex flex-wrap justify-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              openDialog(
                                activeTab === "Notes"
                                  ? "note-create"
                                  : activeTab === "Quizzes"
                                    ? "quiz-create"
                                    : activeTab === "Flashcards"
                                      ? "flashcard-create"
                                      : activeTab === "Resources"
                                        ? "resource-upload"
                                        : "video-upload",
                              )
                            }
                            className="btn-primary"
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Create{" "}
                            {activeTab === "All Content"
                              ? "Content"
                              : activeTab}
                          </button>
                          {activeTab === "Assignments" ||
                          activeTab === "All Content" ? (
                            <Link
                              href="/teacher/assignments/new"
                              className="btn-secondary"
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Create Assignment
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>
                </section>
                <aside className="space-y-4">
                  <Card className="bg-indigo-50/70 p-5">
                    <h2 className="flex items-center gap-2 font-semibold text-slate-900">
                      <Sparkles className="h-5 w-5 text-indigo-600" /> AI
                      Content Assistant{" "}
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-indigo-600">
                        Beta
                      </span>
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">
                      Describe the content you need and open the matching
                      generator.
                    </p>
                    <form onSubmit={runAssistant} className="mt-3 space-y-3">
                      <textarea
                        value={assistantPrompt}
                        onChange={(e) => setAssistantPrompt(e.target.value)}
                        rows={3}
                        className="input-ui w-full resize-y"
                        placeholder="e.g. Create revision notes on Binary Search…"
                      />
                      <button className="btn-primary w-full">
                        <Sparkles className="mr-2 h-4 w-4" />
                        Continue
                      </button>
                    </form>
                  </Card>
                  <Card className="p-5">
                    <h2 className="font-semibold text-slate-900">
                      Quick Actions
                    </h2>
                    <div className="mt-3 space-y-1">
                      {[
                        {
                          title: "Create Course",
                          desc: "Build modules and lessons",
                          href: "/teacher/courses/new",
                          icon: BookOpen,
                        },
                        {
                          title: "Manage Course Content",
                          desc: "Upload lessons and resources",
                          href: "/teacher/courses",
                          icon: Layers3,
                        },
                        {
                          title: "Create Assignment",
                          desc: "Add practice for students",
                          href: "/teacher/assignments/new",
                          icon: ClipboardList,
                        },
                      ].map(({ title, desc, href, icon: Icon }) => (
                        <Link
                          key={title}
                          href={href}
                          className="flex items-center gap-3 rounded-xl p-3 hover:bg-slate-50"
                        >
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-slate-800">
                              {title}
                            </span>
                            <span className="block text-xs text-slate-500">
                              {desc}
                            </span>
                          </span>
                          <ArrowRight className="h-4 w-4 text-slate-400" />
                        </Link>
                      ))}
                    </div>
                  </Card>
                  <Card className="p-5">
                    <div className="flex items-center justify-between">
                      <h2 className="font-semibold text-slate-900">
                        Content Summary
                      </h2>
                      <button
                        type="button"
                        onClick={() => load({ quiet: false })}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                        aria-label="Refresh content"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      {[
                        { title: "Videos", count: videos.length, icon: Video },
                        { title: "Notes", count: counts.Notes, icon: FileText },
                        {
                          title: "Quizzes",
                          count: quizzes.length,
                          icon: CheckSquare,
                        },
                        {
                          title: "Resources",
                          count: resources.length,
                          icon: Layers3,
                        },
                      ].map(({ title, count, icon: Icon }) => (
                        <div key={title} className="rounded-xl bg-slate-50 p-3">
                          <Icon className="h-4 w-4 text-blue-600" />
                          <p className="mt-2 text-xl font-bold text-slate-900">
                            {count}
                          </p>
                          <p className="text-xs text-slate-500">{title}</p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-slate-500">
                      All counts come from your saved content, not demo
                      placeholders.
                    </p>
                  </Card>
                </aside>
              </div>
            </div>
          </main>
        </div>
      </div>

      {dialog ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            className="my-4 w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {{
                    "video-upload": "Upload or import video",
                    "resource-upload": "Upload course resource",
                    "note-create": "Create or generate notes",
                    "note-edit": "Edit notes",
                    "quiz-create": "Generate course quiz",
                    "quiz-preview": "Review quiz",
                    "flashcard-create": "Create flashcards",
                    "assignment-ai": "Generate assignment with AI",
                  }[dialog] || "Content action"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Changes are saved through your existing LearnMate services.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDialog("");
                  setError("");
                }}
                aria-label="Close dialog"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-y-auto p-5">
              {dialog === "video-upload" ? (
                <form onSubmit={uploadVideo} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Course (optional)
                    </label>
                    <select
                      value={selectedCourseId}
                      onChange={(e) => selectCourse(e.target.value)}
                      className={cardInput}
                    >
                      <option value="">Teacher library only</option>
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedCourseId ? (
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                        Attach to lesson (optional)
                      </label>
                      <select
                        value={selectedLessonId}
                        onChange={(e) => setSelectedLessonId(e.target.value)}
                        className={cardInput}
                      >
                        <option value="">
                          Save to library without attaching
                        </option>
                        {(selectedCourseDetail?.modules || []).flatMap(
                          (module) =>
                            (module.lessons || []).map((lesson) => (
                              <option key={lesson.id} value={lesson.id}>
                                {module.title} · {lesson.title}
                              </option>
                            )),
                        )}
                      </select>
                      {!selectedCourseDetail?.modules?.length ? (
                        <p className="mt-1 text-xs text-amber-700">
                          This course has no modules yet. Create a module and
                          lesson in Manage Course Content before attaching the
                          video.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 p-4">
                      <label className="mb-2 block text-sm font-semibold text-slate-800">
                        Upload video file
                      </label>
                      <input
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime"
                        onChange={(e) => {
                          setVideoFile(e.target.files?.[0] || null);
                          if (e.target.files?.[0]) setVideoUrl("");
                        }}
                        className="input-ui w-full"
                      />
                      <p className="mt-2 text-xs text-slate-500">
                        MP4, WebM, or MOV supported by storage limits.
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-4">
                      <label className="mb-2 block text-sm font-semibold text-slate-800">
                        Import YouTube
                      </label>
                      <input
                        type="url"
                        value={videoUrl}
                        onChange={(e) => {
                          setVideoUrl(e.target.value);
                          if (e.target.value) setVideoFile(null);
                        }}
                        placeholder="https://youtube.com/watch?v=..."
                        className={cardInput}
                      />
                    </div>
                  </div>
                  <button
                    disabled={busy || (!videoFile && !videoUrl.trim())}
                    className="btn-primary w-full"
                  >
                    <Upload className="mr-2 inline h-4 w-4" />
                    {busy ? "Adding video…" : "Add Video"}
                  </button>
                </form>
              ) : null}

              {dialog === "resource-upload" ? (
                <form onSubmit={uploadResource} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Course *
                    </label>
                    <select
                      required
                      value={selectedCourseId}
                      onChange={(e) => selectCourse(e.target.value)}
                      className={cardInput}
                    >
                      <option value="">Select course</option>
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedCourseId ? (
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                        Attach to lesson (optional)
                      </label>
                      <select
                        value={selectedLessonId}
                        onChange={(e) => setSelectedLessonId(e.target.value)}
                        className={cardInput}
                      >
                        <option value="">Entire course</option>
                        {(selectedCourseDetail?.modules || []).flatMap(
                          (module) =>
                            (module.lessons || []).map((lesson) => (
                              <option key={lesson.id} value={lesson.id}>
                                {module.title} · {lesson.title}
                              </option>
                            )),
                        )}
                      </select>
                    </div>
                  ) : null}
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      File *
                    </label>
                    <input
                      required
                      type="file"
                      accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg,.webp"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        setResourceFile(f);
                        if (f && !resourceTitle.trim())
                          setResourceTitle(f.name.replace(/\.[^.]+$/, ""));
                      }}
                      className={cardInput}
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      PDF, Word, text/Markdown, and common image files.
                    </p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Title
                    </label>
                    <input
                      value={resourceTitle}
                      onChange={(e) => setResourceTitle(e.target.value)}
                      maxLength={300}
                      className={cardInput}
                      placeholder="Use filename if blank"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Description
                    </label>
                    <textarea
                      value={resourceDescription}
                      onChange={(e) => setResourceDescription(e.target.value)}
                      rows={2}
                      maxLength={4000}
                      className={cardInput}
                      placeholder="Tell students what this file contains"
                    />
                  </div>
                  <button
                    disabled={busy || !selectedCourseId || !resourceFile}
                    className="btn-primary w-full"
                  >
                    <Upload className="mr-2 inline h-4 w-4" />
                    {busy ? "Uploading…" : "Upload and attach"}
                  </button>
                </form>
              ) : null}

              {dialog === "note-create" || dialog === "note-edit" ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setNoteForm((f) => ({ ...f, mode: "write" }))
                      }
                      className={`rounded-lg px-3 py-2 text-sm font-semibold ${noteForm.mode === "write" ? "bg-indigo-50 text-indigo-700" : "bg-slate-50 text-slate-600"}`}
                    >
                      Write notes
                    </button>
                    {!noteForm.id ? (
                      <button
                        type="button"
                        onClick={() =>
                          setNoteForm((f) => ({ ...f, mode: "ai" }))
                        }
                        className={`rounded-lg px-3 py-2 text-sm font-semibold ${noteForm.mode === "ai" ? "bg-indigo-50 text-indigo-700" : "bg-slate-50 text-slate-600"}`}
                      >
                        Generate from video
                      </button>
                    ) : null}
                    {!noteForm.id ? (
                      <button
                        type="button"
                        onClick={() => openDialog("resource-upload")}
                        className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                      >
                        <Upload className="mr-1 inline h-3.5 w-3.5" />
                        Upload note file
                      </button>
                    ) : null}
                  </div>
                  {noteForm.mode === "ai" && !noteForm.id ? (
                    <form onSubmit={generateNotes} className="space-y-4">
                      <div>
                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                          Course (optional)
                        </label>
                        <select
                          value={noteForm.course_id}
                          onChange={(e) =>
                            setNoteForm((f) => ({
                              ...f,
                              course_id: e.target.value,
                            }))
                          }
                          className={cardInput}
                        >
                          <option value="">No course</option>
                          {courses.map((course) => (
                            <option key={course.id} value={course.id}>
                              {course.title}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                          Source video *
                        </label>
                        <select
                          required
                          value={noteForm.video_id}
                          onChange={(e) =>
                            setNoteForm((f) => ({
                              ...f,
                              video_id: e.target.value,
                            }))
                          }
                          className={cardInput}
                        >
                          <option value="">Select video</option>
                          {videos.map((video) => (
                            <option key={video.id} value={video.id}>
                              {video.title || video.url || `Video #${video.id}`}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-xs text-slate-500">
                          AI note generation requires a transcript or a
                          supported public YouTube video.
                        </p>
                      </div>
                      <label className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={Boolean(noteForm.share_with_students)}
                          onChange={(e) =>
                            setNoteForm((f) => ({
                              ...f,
                              share_with_students: e.target.checked,
                            }))
                          }
                          className="mt-0.5"
                        />
                        <span>
                          <span className="font-semibold">
                            Attach notes as a course resource
                          </span>
                          <span className="mt-0.5 block text-xs text-slate-500">
                            Select a course to make a downloadable copy
                            available to enrolled students.
                          </span>
                        </span>
                      </label>
                      <button
                        disabled={busy || !noteForm.video_id}
                        className="btn-primary w-full"
                      >
                        <Sparkles className="mr-2 inline h-4 w-4" />
                        {busy ? "Generating…" : "Generate and Save Notes"}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={saveNote} className="space-y-4">
                      <div>
                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                          Title *
                        </label>
                        <input
                          required
                          value={noteForm.title}
                          onChange={(e) =>
                            setNoteForm((f) => ({
                              ...f,
                              title: e.target.value,
                            }))
                          }
                          maxLength={300}
                          className={cardInput}
                          placeholder="e.g. Binary search revision"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                          Course (optional)
                        </label>
                        <select
                          value={noteForm.course_id}
                          onChange={(e) =>
                            setNoteForm((f) => ({
                              ...f,
                              course_id: e.target.value,
                            }))
                          }
                          className={cardInput}
                        >
                          <option value="">Personal notes</option>
                          {courses.map((course) => (
                            <option key={course.id} value={course.id}>
                              {course.title}
                            </option>
                          ))}
                        </select>
                      </div>
                      {!noteForm.id ? (
                        <label className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={Boolean(noteForm.share_with_students)}
                            onChange={(e) =>
                              setNoteForm((f) => ({
                                ...f,
                                share_with_students: e.target.checked,
                              }))
                            }
                            className="mt-0.5"
                          />
                          <span>
                            <span className="font-semibold">
                              Attach as a course resource
                            </span>
                            <span className="mt-0.5 block text-xs text-slate-500">
                              When a course is selected, enrolled students can
                              download the notes from their classroom.
                            </span>
                          </span>
                        </label>
                      ) : null}
                      <div>
                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                          Note content *
                        </label>
                        <textarea
                          required
                          rows={9}
                          value={noteForm.content}
                          onChange={(e) =>
                            setNoteForm((f) => ({
                              ...f,
                              content: e.target.value,
                            }))
                          }
                          maxLength={200000}
                          className={`${cardInput} resize-y`}
                          placeholder="Write detailed notes here…"
                        />
                      </div>
                      <button disabled={busy} className="btn-primary w-full">
                        <Check className="mr-2 inline h-4 w-4" />
                        {busy
                          ? "Saving…"
                          : noteForm.id
                            ? "Save Changes"
                            : "Save Notes"}
                      </button>
                    </form>
                  )}
                </div>
              ) : null}

              {dialog === "quiz-create" ? (
                <form onSubmit={generateQuiz} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Course *
                    </label>
                    <select
                      required
                      value={quizForm.course_id}
                      onChange={async (e) => {
                        const course_id = e.target.value;
                        setQuizForm((f) => ({ ...f, course_id, video_id: "" }));
                        await selectCourse(course_id);
                      }}
                      className={cardInput}
                    >
                      <option value="">Select course</option>
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Source video *
                    </label>
                    <select
                      required
                      value={quizForm.video_id}
                      onChange={(e) =>
                        setQuizForm((f) => ({ ...f, video_id: e.target.value }))
                      }
                      className={cardInput}
                    >
                      <option value="">Select video</option>
                      {videos.map((video) => (
                        <option key={video.id} value={video.id}>
                          {video.title || video.url || `Video #${video.id}`}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-slate-500">
                      Quiz questions are generated from the selected video's
                      available content.
                    </p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Number of questions
                    </label>
                    <select
                      value={quizForm.num_questions}
                      onChange={(e) =>
                        setQuizForm((f) => ({
                          ...f,
                          num_questions: Number(e.target.value),
                        }))
                      }
                      className={cardInput}
                    >
                      {[5, 10, 15, 20, 25].map((num) => (
                        <option key={num} value={num}>
                          {num} questions
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    disabled={busy || !quizForm.course_id || !quizForm.video_id}
                    className="btn-primary w-full"
                  >
                    <Sparkles className="mr-2 inline h-4 w-4" />
                    {busy ? "Generating quiz…" : "Generate Quiz Draft"}
                  </button>
                </form>
              ) : null}

              {dialog === "quiz-preview" ? (
                quizDetail ? (
                  <div className="space-y-4">
                    <div className="rounded-xl bg-slate-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-slate-900">
                            {quizDetail.title || `Quiz #${quizDetail.id}`}
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">
                            {quizDetail.questions?.length || 0} questions ·{" "}
                            {quizDetail.total_points || 0} points ·{" "}
                            {String(quizDetail.status || "draft").toLowerCase()}
                          </p>
                        </div>
                        {String(quizDetail.status).toUpperCase() !==
                        "PUBLISHED" ? (
                          <button
                            type="button"
                            disabled={busy || !quizDetail.questions?.length}
                            onClick={() => publishQuiz(quizDetail.id)}
                            className="btn-primary"
                          >
                            {busy ? "Publishing…" : "Publish for students"}
                          </button>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                            Published
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-3">
                      {(quizDetail.questions || []).map((q, i) => (
                        <div
                          key={q.id || i}
                          className="rounded-xl border border-slate-200 p-4"
                        >
                          <p className="text-sm font-semibold text-slate-800">
                            {i + 1}.{" "}
                            {q.question_text || q.question || "Question"}
                          </p>
                          {q.options && typeof q.options === "object" ? (
                            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                              {Object.entries(q.options).map(([key, value]) => (
                                <div
                                  key={key}
                                  className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600"
                                >
                                  {key}. {value}
                                </div>
                              ))}
                            </div>
                          ) : null}
                          {q.correct_answer ? (
                            <p className="mt-2 text-xs text-emerald-700">
                              Correct answer: {q.correct_answer}
                            </p>
                          ) : null}
                          {q.explanation ? (
                            <p className="mt-1 text-xs text-slate-500">
                              {q.explanation}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDialog("");
                        load({ quiet: true });
                      }}
                      className="btn-secondary w-full"
                    >
                      Close review
                    </button>
                  </div>
                ) : (
                  <div className="p-8 text-center text-sm text-slate-500">
                    Quiz details are not available yet.
                  </div>
                )
              ) : null}

              {dialog === "flashcard-create" ? (
                <form onSubmit={saveFlashcards} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Set title *
                    </label>
                    <input
                      required
                      value={flashcardForm.title}
                      onChange={(e) =>
                        setFlashcardForm((f) => ({
                          ...f,
                          title: e.target.value,
                        }))
                      }
                      className={cardInput}
                      placeholder="e.g. Operating systems revision"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Course (optional)
                    </label>
                    <select
                      value={flashcardForm.course_id}
                      onChange={(e) =>
                        setFlashcardForm((f) => ({
                          ...f,
                          course_id: e.target.value,
                        }))
                      }
                      className={cardInput}
                    >
                      <option value="">Personal set</option>
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-3">
                    {flashcardForm.cards.map((card, index) => (
                      <div
                        key={index}
                        className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-2"
                      >
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-600">
                            Card {index + 1} · Front
                          </label>
                          <textarea
                            rows={2}
                            required
                            value={card.front}
                            onChange={(e) =>
                              updateFlashcard(index, "front", e.target.value)
                            }
                            className={`${cardInput} resize-y`}
                            placeholder="Question / term"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-600">
                            Back
                          </label>
                          <textarea
                            rows={2}
                            required
                            value={card.back}
                            onChange={(e) =>
                              updateFlashcard(index, "back", e.target.value)
                            }
                            className={`${cardInput} resize-y`}
                            placeholder="Answer / definition"
                          />
                        </div>
                        {flashcardForm.cards.length > 1 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setFlashcardForm((f) => ({
                                ...f,
                                cards: f.cards.filter((_, i) => i !== index),
                              }))
                            }
                            className="text-left text-xs font-semibold text-red-600 sm:col-span-2"
                          >
                            Remove card
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={addFlashcard}
                    className="btn-secondary w-full"
                  >
                    <Plus className="mr-2 inline h-4 w-4" />
                    Add another card
                  </button>
                  <button disabled={busy} className="btn-primary w-full">
                    <Check className="mr-2 inline h-4 w-4" />
                    {busy ? "Saving…" : "Save Flashcard Set"}
                  </button>
                </form>
              ) : null}

              {dialog === "assignment-ai" ? (
                <div className="space-y-4">
                  {!generatedAssignment ? (
                    <form onSubmit={generateAssignment} className="space-y-4">
                      <div>
                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                          Topic *
                        </label>
                        <input
                          required
                          value={assignmentForm.topic}
                          onChange={(e) =>
                            setAssignmentForm((f) => ({
                              ...f,
                              topic: e.target.value,
                            }))
                          }
                          className={cardInput}
                          placeholder="e.g. Binary Search Trees"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                          Course (required before saving)
                        </label>
                        <select
                          value={assignmentForm.course_id}
                          onChange={(e) =>
                            setAssignmentForm((f) => ({
                              ...f,
                              course_id: e.target.value,
                            }))
                          }
                          className={cardInput}
                        >
                          <option value="">Select course</option>
                          {courses.map((course) => (
                            <option key={course.id} value={course.id}>
                              {course.title}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                            Difficulty
                          </label>
                          <select
                            value={assignmentForm.difficulty}
                            onChange={(e) =>
                              setAssignmentForm((f) => ({
                                ...f,
                                difficulty: e.target.value,
                              }))
                            }
                            className={cardInput}
                          >
                            <option value="beginner">Beginner</option>
                            <option value="intermediate">Intermediate</option>
                            <option value="advanced">Advanced</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                            Audience
                          </label>
                          <input
                            value={assignmentForm.audience}
                            onChange={(e) =>
                              setAssignmentForm((f) => ({
                                ...f,
                                audience: e.target.value,
                              }))
                            }
                            className={cardInput}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                          Extra context (optional)
                        </label>
                        <textarea
                          rows={3}
                          value={assignmentForm.notes}
                          onChange={(e) =>
                            setAssignmentForm((f) => ({
                              ...f,
                              notes: e.target.value,
                            }))
                          }
                          className={cardInput}
                          placeholder="Learning objectives, constraints, or context"
                        />
                      </div>
                      <button disabled={busy} className="btn-primary w-full">
                        <Sparkles className="mr-2 inline h-4 w-4" />
                        {busy ? "Generating…" : "Generate Assignment Draft"}
                      </button>
                    </form>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-xl bg-slate-50 p-4">
                        <h3 className="font-semibold text-slate-900">
                          {generatedAssignment.title}
                        </h3>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                          {generatedAssignment.description}
                        </p>
                        <h4 className="mt-4 text-sm font-semibold text-slate-800">
                          Instructions
                        </h4>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                          {generatedAssignment.instructions}
                        </p>
                        {generatedAssignment.rubric?.length ? (
                          <>
                            <h4 className="mt-4 text-sm font-semibold text-slate-800">
                              Suggested rubric
                            </h4>
                            <ul className="mt-1 list-disc pl-5 text-sm text-slate-600">
                              {generatedAssignment.rubric.map((r, i) => (
                                <li key={i}>
                                  {r.criterion} — {r.points} points
                                </li>
                              ))}
                            </ul>
                          </>
                        ) : null}
                      </div>
                      <p className="text-xs text-slate-500">
                        The assignment editor will let you review the details
                        and add required MCQ questions before saving to the
                        course.
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setGeneratedAssignment(null)}
                          className="btn-secondary flex-1"
                        >
                          Regenerate
                        </button>
                        <button
                          type="button"
                          onClick={useGeneratedAssignment}
                          disabled={!assignmentForm.course_id}
                          className="btn-primary flex-1"
                        >
                          Open Assignment Builder
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            {error && dialog ? (
              <div className="border-t border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {viewItem?.tags?.cards ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div>
                <h2 className="font-bold text-slate-900">{viewItem.title}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {viewItem.tags.cards.length} flashcards
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewItem(null)}
                aria-label="Close flashcards"
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[60vh] space-y-3 overflow-y-auto p-5">
              {viewItem.tags.cards.map((card, i) => (
                <div
                  key={i}
                  className="grid gap-2 rounded-xl border border-slate-200 p-4 sm:grid-cols-2"
                >
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-400">
                      Front
                    </p>
                    <p className="mt-1 text-sm text-slate-800">{card.front}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-400">
                      Back
                    </p>
                    <p className="mt-1 text-sm text-slate-700">{card.back}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
