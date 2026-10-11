import Card from "@/components/ui/Card";

export default function NotesPanel({
  title = "Notes",
  description = "Read and revise the key points from this lesson."
}) {
  return (
    <Card className="p-5">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{description}</p>

      <div className="mt-5 space-y-3">
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Topic summary and quick revision points.
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Important definitions and formulas.
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Common questions and short answers.
        </div>
      </div>
    </Card>
  );
}