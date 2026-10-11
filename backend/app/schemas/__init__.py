from app.schemas.common import ErrorDetail, ErrorResponse, SuccessResponse
from app.schemas.user import UserOut, UserProfileOut, UserProfileUpdate
from app.schemas.auth import (
    RegisterRequest, RegisterResponse, LoginRequest, AuthResponse,
    TokenPair, RefreshRequest, ForgotPasswordRequest, ResetPasswordRequest,
    VerifyEmailRequest, MessageResponse,
)
from app.schemas.course import (
    CourseBase, CourseCreate, CourseUpdate, CourseListItem,
    CourseDetail, CourseDetailWithLessons, CourseListResponse, EnrollmentOut,
)
from app.schemas.module import ModuleBase, ModuleCreate, ModuleUpdate, ModuleOut, ModuleWithLessonsOut
from app.schemas.lesson import LessonBase, LessonCreate, LessonUpdate, LessonOut
from app.schemas.video import (
    VideoCreateFromYouTube, VideoCreateResponse, VideoOut,
    VideoDetailOut, VideoStatusOut, VideoProgressIn, VideoProgressOut,
)
from app.schemas.ai import (
    TutorAskRequest, TutorAskResponse, AIMessageOut, AIConversationOut,
    ConversationDetailOut, SummaryRequest, SummaryOut,
    NotesFromVideoRequest, NotesOut, QuizFromVideoRequest, QuizOut,
    CourseOutlineRequest, AssignmentGenRequest, UsageOut,
)
from app.schemas.quiz import (
    QuizCreate, QuizUpdate, QuizOut, QuizDetailOut, QuizAuthorDetailOut,
    QuizQuestionCreate, QuizQuestionAuthorOut, QuizQuestionStudentOut,
    AnswerIn, AttemptStartOut, AttemptSubmitIn, AttemptResultOut, AttemptAnswerOut,
)
from app.schemas.assignment import (
    AssignmentCreate, AssignmentUpdate, AssignmentOut,
    SubmissionCreate, SubmissionGrade, SubmissionOut, SubmissionListOut,
)
from app.schemas.progress import (
    LessonCompleteIn, ProgressOut, CourseProgressOut,
    VideoProgressIn as VideoProgressIn2, VideoProgressOut as VideoProgressOut2,
)
from app.schemas.analytics import (
    StudentAnalyticsOut, TeacherAnalyticsOut, StreakOut,
    CourseProgressSummary, QuizPerf, WeakTopic, RoadmapStep, TeacherCourseStat,
)

from app.schemas.chat import (
    ConversationStartIn, ConversationOut, ConversationListItem,
    ConversationDetailOut, MessageSendIn, MessageOut, MessageListOut,
    UnreadCountOut as ChatUnreadCountOut, ChatConversationListOut,
)
from app.schemas.notification import (
    NotificationOut, NotificationListOut,
    UnreadCountOut as NotificationUnreadCountOut,
    MessageResponse as NotificationMessageResponse,
)
from app.schemas.file import FileOut, FileWithUrlOut, FileListOut
from app.schemas.export import (
    NotesExportIn, QuizResultExportIn, ExportOut, ExportTaskOut,
)
from app.schemas.note import (
    NoteCreate, NoteUpdate, NoteOut, NoteListOut, NoteVersionOut,
)
__all__ = [
    # common / user / auth
    "ErrorDetail", "ErrorResponse", "SuccessResponse",
    "UserOut", "UserProfileOut", "UserProfileUpdate",
    "RegisterRequest", "RegisterResponse", "LoginRequest", "AuthResponse",
    "TokenPair", "RefreshRequest", "ForgotPasswordRequest", "ResetPasswordRequest",
    "VerifyEmailRequest", "MessageResponse",
    # course / module / lesson
    "CourseBase", "CourseCreate", "CourseUpdate", "CourseListItem",
    "CourseDetail", "CourseDetailWithLessons", "CourseListResponse", "EnrollmentOut",
    "ModuleBase", "ModuleCreate", "ModuleUpdate", "ModuleOut", "ModuleWithLessonsOut",
    "LessonBase", "LessonCreate", "LessonUpdate", "LessonOut",
    # video
    "VideoCreateFromYouTube", "VideoCreateResponse", "VideoOut",
    "VideoDetailOut", "VideoStatusOut", "VideoProgressIn", "VideoProgressOut",
    # ai
    "TutorAskRequest", "TutorAskResponse", "AIMessageOut", "AIConversationOut",
    "ConversationDetailOut", "SummaryRequest", "SummaryOut",
    "NotesFromVideoRequest", "NotesOut", "QuizFromVideoRequest", "QuizOut",
    "CourseOutlineRequest", "AssignmentGenRequest", "UsageOut",
    # quiz
    "QuizCreate", "QuizUpdate", "QuizOut", "QuizDetailOut", "QuizAuthorDetailOut",
    "QuizQuestionCreate", "QuizQuestionAuthorOut", "QuizQuestionStudentOut",
    "AnswerIn", "AttemptStartOut", "AttemptSubmitIn", "AttemptResultOut", "AttemptAnswerOut",
    # assignment
    "AssignmentCreate", "AssignmentUpdate", "AssignmentOut",
    "SubmissionCreate", "SubmissionGrade", "SubmissionOut", "SubmissionListOut",
    # progress
    "LessonCompleteIn", "ProgressOut", "CourseProgressOut",
    "VideoProgressIn2", "VideoProgressOut2",
    # analytics
    "StudentAnalyticsOut", "TeacherAnalyticsOut", "StreakOut",
    "CourseProgressSummary", "QuizPerf", "WeakTopic", "RoadmapStep", "TeacherCourseStat",

     # chat
    "ConversationStartIn", "ConversationOut", "ConversationListItem",
    "ConversationDetailOut", "MessageSendIn", "MessageOut", "MessageListOut",
    "ChatUnreadCountOut", "ChatConversationListOut",
    # notification
    "NotificationOut", "NotificationListOut",
    "NotificationUnreadCountOut", "NotificationMessageResponse",

    # __all__ additions:
    "FileOut", "FileWithUrlOut", "FileListOut",
    "NotesExportIn", "QuizResultExportIn", "ExportOut", "ExportTaskOut",


    # add to __all__:
    "NoteCreate", "NoteUpdate", "NoteOut", "NoteListOut", "NoteVersionOut",
]