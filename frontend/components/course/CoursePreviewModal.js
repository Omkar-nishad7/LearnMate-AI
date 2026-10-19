"use client";

import { BookOpen, CheckCircle2, Clock3, Layers3, X } from "lucide-react";

function asList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  if (typeof value === "string") return value.split("\n").map((item) => item.trim()).filter(Boolean);
  return [];
}

function moduleLessons(module) {
  if (!Array.isArray(module?.lessons)) return [];
  return module.lessons.map((lesson) => typeof lesson === "string" ? lesson : lesson?.title).map((title) => String(title || "").trim()).filter(Boolean);
}

function priceLabel(course) {
  if (course?.is_free || !Number(course?.price_cents)) return "Free";
  const currency = course?.price_currency === "USD" ? "USD" : "INR";
  try {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(Number(course.price_cents) / 100);
  } catch {
    return `${currency === "INR" ? "₹" : "$"}${(Number(course.price_cents) / 100).toFixed(2)}`;
  }
}

export default function CoursePreviewModal({ course, modules = [], instructor = null, onClose }) {
  if (!course) return null;
  const outcomes = asList(course.learning_outcomes);
  const skills = asList(course.skills);
  const requirements = asList(course.requirements);
  const projects = asList(course.projects);
  const learningPath = asList(course.learning_path);
  const aiFeatures = asList(course.ai_features);
  const includedFeatures = asList(course.included_features);
  const faqs = Array.isArray(course.faqs)
    ? course.faqs.filter((faq) => faq?.question || faq?.answer)
    : [];
  const lessonCount = modules.reduce((sum, module) => sum + moduleLessons(module).length, 0);
  const duration = Number(course.duration_minutes || 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label="Student course preview">
      <div className="my-3 w-full max-w-6xl overflow-hidden rounded-3xl bg-slate-50 shadow-2xl sm:my-6">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">Student view preview</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">{course.title || "Untitled course"}</h2>
            <p className="mt-0.5 text-xs text-slate-500">Preview only · unsaved edits are visible here</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100" aria-label="Close preview"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_310px]">
          <div className="min-w-0 space-y-5">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {course.thumbnail_url ? (
                <div className="h-52 bg-slate-100 sm:h-64"><img src={course.thumbnail_url} alt="Course cover" className="h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} /></div>
              ) : (
                <div className="flex h-44 items-center gap-4 bg-gradient-to-r from-indigo-50 to-blue-50 px-6 sm:h-52"><span className="rounded-2xl bg-white p-4 text-indigo-600 shadow-sm"><BookOpen className="h-8 w-8" /></span><div><p className="text-xs font-bold uppercase tracking-wide text-indigo-600">{course.category || "LearnMate AI course"}</p><p className="mt-2 text-xl font-bold text-slate-900">{course.title || "Your course title"}</p></div></div>
              )}
              <div className="p-5 sm:p-7">
                <div className="flex flex-wrap gap-2"><span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold capitalize text-indigo-700">{course.category || "General"}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">{course.difficulty || "All levels"}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{course.language || "en"}</span></div>
                <h3 className="mt-4 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">{course.title || "Your course title"}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{course.short_description || course.description || "Your short course introduction will appear here."}</p>
                <div className="mt-5 flex flex-wrap gap-4 text-xs font-medium text-slate-500"><span className="inline-flex items-center gap-1.5"><Layers3 className="h-4 w-4" />{modules.length} modules · {lessonCount} lessons</span><span className="inline-flex items-center gap-1.5"><Clock3 className="h-4 w-4" />{duration ? `${duration} minutes` : "Duration not set"}</span></div>
              </div>
            </section>
            {course.description ? <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-900">About this course</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{course.description}</p></section> : null}
            {(instructor || course.teacher_name) ? <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-900">Instructor</h3><div className="mt-3 flex items-center gap-3">{instructor?.avatar_url || course.teacher_avatar_url ? <img src={instructor?.avatar_url || course.teacher_avatar_url} alt="Instructor" className="h-12 w-12 rounded-full object-cover" /> : <span className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-lg font-bold text-indigo-700">{(instructor?.full_name || instructor?.display_name || course.teacher_name || "T").slice(0, 1).toUpperCase()}</span>}<div><p className="font-semibold text-slate-900">{instructor?.display_name || instructor?.full_name || course.teacher_name || "Course instructor"}</p><p className="mt-1 text-xs text-slate-500">{instructor?.bio || instructor?.organization || "Instructor profile and background are managed from the teacher profile."}</p></div></div></section> : null}
            {outcomes.length ? <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-900">What you’ll learn</h3><div className="mt-4 grid gap-3 sm:grid-cols-2">{outcomes.map((item, index) => <p key={`${item}-${index}`} className="flex gap-2 text-sm leading-5 text-slate-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{item}</p>)}</div></section> : null}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-900">Course curriculum</h3>{modules.length ? <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">{modules.map((module, index) => <details key={module.id || `${module.title}-${index}`} className="p-4" open={index === 0}><summary className="cursor-pointer text-sm font-semibold text-slate-800">Module {index + 1}: {module.title || "Untitled module"}<span className="ml-2 text-xs font-normal text-slate-500">{moduleLessons(module).length} lessons</span></summary><ul className="mt-3 space-y-2 pl-4">{moduleLessons(module).map((lesson, lessonIndex) => <li key={`${lesson}-${lessonIndex}`} className="list-disc text-sm text-slate-600">{lesson}</li>)}</ul></details>)}</div> : <p className="mt-3 text-sm text-slate-500">Add modules and lessons to display your curriculum.</p>}</section>
            {learningPath.length ? <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-900">Learning path</h3><p className="mt-1 text-xs text-slate-500">A structured roadmap from foundations to practice.</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{learningPath.map((item, index) => <div key={`${item}-${index}`} className="flex items-start gap-3 rounded-xl border border-slate-100 p-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-700">{index + 1}</span><p className="pt-1 text-sm font-medium text-slate-700">{item}</p></div>)}</div></section> : null}
            {projects.length ? <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-900">Projects you’ll build</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{projects.map((item, index) => <div key={`${item}-${index}`} className="rounded-xl bg-slate-50 p-3 text-sm font-medium text-slate-700">{item}</div>)}</div></section> : null}
            {aiFeatures.length ? <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-900">AI learning features</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{aiFeatures.map((item, index) => <div key={`${item}-${index}`} className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-sm font-medium text-indigo-800">{item}</div>)}</div></section> : null}
            {skills.length ? <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-900">Skills you’ll gain</h3><div className="mt-3 flex flex-wrap gap-2">{skills.map((item, index) => <span key={`${item}-${index}`} className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">{item}</span>)}</div></section> : null}
            {requirements.length ? <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-900">Requirements</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">{requirements.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></section> : null}
            {faqs.length ? <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-900">Frequently asked questions</h3>{faqs.map((faq, index) => <details key={`${faq.question}-${index}`} className="border-b border-slate-100 py-3 last:border-0"><summary className="cursor-pointer text-sm font-semibold text-slate-800">{faq.question}</summary><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{faq.answer}</p></details>)}</section> : null}
          </div>
          <aside className="space-y-4 lg:sticky lg:top-[88px] lg:self-start">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Course price</p><p className="mt-2 text-3xl font-black text-slate-900">{priceLabel(course)}</p><p className="mt-2 text-xs leading-5 text-slate-500">This is a preview; checkout is not active here.</p><button type="button" disabled className="mt-4 w-full cursor-not-allowed rounded-xl bg-indigo-300 px-4 py-3 text-sm font-bold text-white">Preview only</button><div className="mt-4 space-y-2 text-xs text-slate-600"><p className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />Course content access after enrollment</p><p className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />Modules and lessons listed below</p></div>{includedFeatures.length ? <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-600">{includedFeatures.map((item, index) => <p key={`${item}-${index}`} className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />{item}</p>)}</div> : null}</section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-900">Publishing checklist</h3><p className="mt-2 text-sm leading-5 text-slate-500">Review the title, summary, image, price, skills and curriculum before publishing.</p></section>
          </aside>
        </div>
      </div>
    </div>
  );
}
