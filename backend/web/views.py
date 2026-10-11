from pathlib import Path
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from app.config.settings import settings

def _ctx(request, extra=None):
    base = {
        "request": request,
        "env": settings.ENVIRONMENT,
        "sentry_dsn": settings.SENTRY_DSN,
    }
    if extra:
        base.update(extra)
    return base

TEMPLATES_DIR = Path(__file__).resolve().parents[3] / "frontend" / "templates"
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

router = APIRouter(tags=["web"])


@router.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", _ctx(request))


# --------- Auth shells ---------
@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse("auth/login.html", _ctx(request))


@router.get("/register", response_class=HTMLResponse)
async def register_page(request: Request):
    return templates.TemplateResponse("auth/register.html", _ctx(request))


@router.get("/forgot-password", response_class=HTMLResponse)
async def forgot_password_page(request: Request):
    return templates.TemplateResponse("auth/forgot-password.html", _ctx(request))


@router.get("/reset-password", response_class=HTMLResponse)
async def reset_password_page(request: Request):
    return templates.TemplateResponse("auth/reset-password.html", _ctx(request))


@router.get("/verify-email", response_class=HTMLResponse)
async def verify_email_page(request: Request):
    return templates.TemplateResponse("auth/verify-email.html", _ctx(request))


# --------- Student shells ---------
STUDENT_PAGES = {
    "dashboard": "student/dashboard.html",
    "courses": "student/courses.html",
    "course": "student/course-detail.html",
    "video-studio": "student/video-studio.html",
    "ai-tutor": "student/ai-tutor.html",
    "notes": "student/notes.html",
    "note-editor": "student/note-editor.html",
    "quiz": "student/quiz.html",
    "quiz-result": "student/quiz-result.html",
    "assignments": "student/assignments.html",
    "assignment-detail": "student/assignment-detail.html",
    "progress": "student/progress.html",
    "messages": "student/messages.html",
    "notifications": "student/notifications.html",
    "profile": "student/profile.html",
}


@router.get("/app/student/{page}", response_class=HTMLResponse)
async def student_page(page: str, request: Request):
    tpl = STUDENT_PAGES.get(page)
    if not tpl:
        return RedirectResponse("/app/student/dashboard", status_code=302)
    return templates.TemplateResponse(tpl, _ctx(request, {"page": page}))


# --------- Teacher shells ---------
TEACHER_PAGES = {
    "dashboard": "teacher/dashboard.html",
    "courses": "teacher/courses.html",
    "course-builder": "teacher/course-builder.html",
    "students": "teacher/students.html",
    "assignments": "teacher/assignments.html",
    "assignment-detail": "teacher/assignment-detail.html",
    "quizzes": "teacher/quizzes.html",
    "quiz-builder": "teacher/quiz-builder.html",
    "ai-studio": "teacher/ai-studio.html",
    "messages": "teacher/messages.html",
    "analytics": "teacher/analytics.html",
    "profile": "teacher/profile.html",
}


@router.get("/app/teacher/{page}", response_class=HTMLResponse)
async def teacher_page(page: str, request: Request):
    tpl = TEACHER_PAGES.get(page)
    if not tpl:
        return RedirectResponse("/app/teacher/dashboard", status_code=302)
    return templates.TemplateResponse(tpl, _ctx(request, {"page": page}))