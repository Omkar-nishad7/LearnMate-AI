import Card from "@/components/ui/Card";

export default function QuizCard({
  title = "Quiz",
  questions = 0,
  time = "0 min",
  score = "0/0"
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {questions} questions • {time}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          Score: {score}
        </span>
      </div>

      <div className="mt-5 rounded-2xl bg-slate-50 p-4">
        <p className="text-sm leading-6 text-slate-600">
          Practice quiz to check your understanding and improve revision.
        </p>
      </div>

      <button className="btn-primary mt-5 w-full">
        Start Quiz
      </button>
    </Card>
  );
}