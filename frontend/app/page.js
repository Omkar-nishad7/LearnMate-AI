import Link from "next/link";
import {
  ArrowRight,
  Brain,
  BookOpen,
  LayoutDashboard,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const features = [
  {
    icon: LayoutDashboard,
    title: "Smart Dashboard",
    desc: "Track learning progress, courses, and activity in one place.",
  },
  {
    icon: Brain,
    title: "AI Tutor",
    desc: "Get instant help with learning, doubts, and explanations.",
  },
  {
    icon: BookOpen,
    title: "Course Library",
    desc: "Access structured courses, notes, and video lessons.",
  },
  {
    icon: MessageSquareText,
    title: "AI Chat",
    desc: "Ask questions and get guided support while studying.",
  },
  {
    icon: ShieldCheck,
    title: "Role Based",
    desc: "Separate student and teacher experiences with clean flows.",
  },
  {
    icon: Sparkles,
    title: "Modern UI",
    desc: "Clean, responsive interface inspired by your provided design.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="container-page py-8">
        <header className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-card">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              LearnMate AI
            </h1>
            <p className="text-sm text-slate-500">Smart learning platform</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="btn-secondary">
              Login
            </Link>
            <Link href="/auth/register" className="btn-primary">
              Get Started
            </Link>
          </div>
        </header>

        <div className="grid gap-8 py-14 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
              Built for students and teachers
            </span>
            <h2 className="mt-5 max-w-xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Learn smarter with AI-powered study tools.
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              LearnMate AI combines dashboards, courses, notes, quizzes, and AI
              chat into one clean learning system.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/auth/register" className="btn-primary">
                Start Learning
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link href="/auth/login" className="btn-secondary">
                Login to Continue
              </Link>
            </div>
          </div>

          <div className="card-ui p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {features.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-900">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {item.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
