from datetime import datetime, timezone
from io import BytesIO
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models.note import Note
from app.models.quiz import QuizAttempt
from app.models.user import User
from app.repositories.note_repository import NoteRepository
from app.repositories.quiz_repository import QuizRepository
from app.repositories.user_repository import UserRepository
from app.services.file_service import FileService

BRAND_NAVY = colors.HexColor("#0B1F4D")
BRAND_ORANGE = colors.HexColor("#FF6B00")


def _styles():
    ss = getSampleStyleSheet()
    ss.add(ParagraphStyle(name="BrandTitle", fontSize=22, leading=26,
                          textColor=BRAND_NAVY, spaceAfter=6, fontName="Helvetica-Bold"))
    ss.add(ParagraphStyle(name="BrandSub", fontSize=10, leading=14,
                          textColor=BRAND_ORANGE, spaceAfter=14, fontName="Helvetica-Bold"))
    ss.add(ParagraphStyle(name="SectionHead", fontSize=13, leading=16,
                          textColor=BRAND_NAVY, spaceBefore=10, spaceAfter=6, fontName="Helvetica-Bold"))
    ss.add(ParagraphStyle(name="Body2", fontSize=10, leading=14, textColor=colors.black))
    return ss


class PDFService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.notes = NoteRepository(db)
        self.quizzes = QuizRepository(db)
        self.users = UserRepository(db)
        self.files = FileService(db)

    # ---------------- Notes PDF ----------------
    def _render_notes(self, note: Note, owner_name: str) -> bytes:
        ss = _styles()
        buf = BytesIO()
        doc = SimpleDocTemplate(
            buf, pagesize=A4,
            leftMargin=2 * cm, rightMargin=2 * cm, topMargin=2 * cm, bottomMargin=2 * cm,
            title=note.title, author="LearnMate AI",
        )
        story = [
            Paragraph("LearnMate AI", ss["BrandSub"]),
            Paragraph(note.title, ss["BrandTitle"]),
            Paragraph(
                f"Owner: {owner_name} &nbsp;&nbsp; | &nbsp;&nbsp; "
                f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
                ss["Body2"],
            ),
            Spacer(1, 0.4 * cm),
            Paragraph("Content", ss["SectionHead"]),
        ]
        for block in (note.content or "").split("\n\n"):
            text = block.strip().replace("\n", "<br/>")
            if text:
                story.append(Paragraph(text, ss["Body2"]))
                story.append(Spacer(1, 0.2 * cm))

        tags = (note.tags or {}).get("key_terms") if note.tags else None
        if tags:
            story.append(Paragraph("Key Terms", ss["SectionHead"]))
            rows = [["Term", "Definition"]]
            for kt in tags:
                rows.append([kt.get("term", ""), kt.get("definition", "")])
            t = Table(rows, colWidths=[4 * cm, 12 * cm])
            t.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), BRAND_NAVY),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
            ]))
            story.append(t)

        story.append(Spacer(1, 0.6 * cm))
        story.append(Paragraph(
            f"<i>Note ID: {note.id} — version {note.current_version}</i>", ss["Body2"]
        ))
        doc.build(story)
        return buf.getvalue()

    async def export_note(self, user: User, note_id: int) -> tuple[int, str, int]:
        note = await self.notes.get(note_id)
        if not note:
            raise NotFoundError("Note not found")
        if note.user_id != user.id:
            raise NotFoundError("Note not found")  # don't leak
        owner = await self.users.get_by_id(note.user_id)
        owner_name = owner.profile.full_name if owner and owner.profile else f"user#{note.user_id}"

        pdf_bytes = self._render_notes(note, owner_name)
        filename = f"note-{note.id}-{datetime.now(timezone.utc).strftime('%Y%m%d')}.pdf"
        f = await self.files.store_bytes(
            owner_id=user.id, filename=filename, data=pdf_bytes,
            mime_type="application/pdf", category="pdf", is_public=False,
        )
        await self.db.commit()
        await self.db.refresh(f)
        return f.id, f.original_name, f.size_bytes or 0

    # ---------------- Quiz Result PDF ----------------
    def _render_quiz_result(self, attempt: QuizAttempt, quiz_title: str, student_name: str) -> bytes:
        ss = _styles()
        buf = BytesIO()
        doc = SimpleDocTemplate(
            buf, pagesize=A4,
            leftMargin=2 * cm, rightMargin=2 * cm, topMargin=2 * cm, bottomMargin=2 * cm,
            title=f"Quiz Result — {quiz_title}", author="LearnMate AI",
        )
        story = [
            Paragraph("LearnMate AI", ss["BrandSub"]),
            Paragraph(f"Quiz Result — {quiz_title}", ss["BrandTitle"]),
            Paragraph(
                f"Student: {student_name} &nbsp;&nbsp; | &nbsp;&nbsp; "
                f"Completed: {attempt.completed_at.strftime('%Y-%m-%d %H:%M UTC') if attempt.completed_at else '—'}",
                ss["Body2"],
            ),
            Spacer(1, 0.4 * cm),
        ]

        summary_rows = [
            ["Score", f"{attempt.score:.1f} / {attempt.max_score:.1f}"],
            ["Percentage", f"{attempt.percentage:.1f}%"],
            ["Result", "Passed" if attempt.passed else "Failed"],
            ["Time taken", f"{attempt.time_taken_seconds}s" if attempt.time_taken_seconds else "—"],
        ]
        t = Table(summary_rows, colWidths=[5 * cm, 11 * cm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (0, -1), BRAND_NAVY),
            ("TEXTCOLOR", (0, 0), (0, -1), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        story.append(t)

        weak = (attempt.weak_topics or {}).get("items") or []
        if weak:
            story.append(Paragraph("Weak Topics", ss["SectionHead"]))
            rows = [["Topic", "Misses / Attempts", "Accuracy"]]
            for w in weak:
                rows.append([
                    w.get("topic", "—"),
                    f"{w.get('misses', 0)} / {w.get('attempts', 0)}",
                    f"{w.get('accuracy', 0) * 100:.1f}%",
                ])
            wt = Table(rows, colWidths=[7 * cm, 5 * cm, 4 * cm])
            wt.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), BRAND_ORANGE),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
            ]))
            story.append(wt)

        story.append(Spacer(1, 0.6 * cm))
        story.append(Paragraph(
            f"<i>Attempt ID: {attempt.id} — quiz: {attempt.quiz_id}</i>", ss["Body2"]
        ))
        doc.build(story)
        return buf.getvalue()

    async def export_quiz_result(self, user: User, attempt_id: int) -> tuple[int, str, int]:
        attempt = await self.quizzes.get_attempt(attempt_id, with_answers=True)
        if not attempt:
            raise NotFoundError("Attempt not found")
        # only the student or the quiz creator (or admin) may export
        quiz = await self.quizzes.get(attempt.quiz_id)
        if not quiz:
            raise NotFoundError("Quiz not found")
        if not (attempt.student_id == user.id or quiz.creator_id == user.id or user.role.value == "ADMIN"):
            raise NotFoundError("Attempt not found")  # avoid leak

        student = await self.users.get_by_id(attempt.student_id)
        student_name = (
            student.profile.full_name if student and student.profile else f"user#{attempt.student_id}"
        )
        pdf_bytes = self._render_quiz_result(attempt, quiz.title, student_name)
        filename = f"quiz-result-{attempt.id}-{datetime.now(timezone.utc).strftime('%Y%m%d')}.pdf"
        f = await self.files.store_bytes(
            owner_id=user.id, filename=filename, data=pdf_bytes,
            mime_type="application/pdf", category="pdf", is_public=False,
        )
        await self.db.commit()
        await self.db.refresh(f)
        return f.id, f.original_name, f.size_bytes or 0