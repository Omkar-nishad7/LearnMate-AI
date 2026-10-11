from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class StreakOut(BaseModel):
    current_streak_days: int
    longest_streak_days: int
    last_activity_date: Optional[str] = None


class CourseProgressSummary(BaseModel):
    course_id: int
    title: str
    progress_percent: float
    completed: bool
    last_activity_at: Optional[datetime] = None


class QuizPerf(BaseModel):
    total_attempts: int
    avg_percentage: float
    passed: int
    failed: int


class WeakTopic(BaseModel):
    topic: str
    misses: int
    attempts: int
    accuracy: float


class RoadmapStep(BaseModel):
    order: int
    course_id: int
    title: str
    reason: str


class ActivityPoint(BaseModel):
    label: str
    value: int
    date: str


class StudentAnalyticsOut(BaseModel):
    streak: StreakOut
    courses: List[CourseProgressSummary]
    overall_progress_percent: float
    quiz_performance: QuizPerf
    weak_topics: List[WeakTopic]
    roadmap: List[RoadmapStep]
    recent_activity_count_7d: int
    activity_last_7_days: List[ActivityPoint] = Field(default_factory=list)


class TeacherCourseStat(BaseModel):
    course_id: int
    title: str
    status: str
    enrolled_count: int
    completed_count: int
    avg_progress_percent: float
    avg_quiz_percentage: Optional[float] = None


class TeacherAnalyticsOut(BaseModel):
    total_courses: int
    total_students: int
    courses: List[TeacherCourseStat]
    activity_last_7_days: List[ActivityPoint] = Field(default_factory=list)
