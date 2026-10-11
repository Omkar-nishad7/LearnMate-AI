import Card from "@/components/ui/Card";

export default function ProgressCard({
  title,
  subtitle,
  value,
  progress = 0
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">{subtitle}</h3>
        </div>
        <span className="text-sm font-medium text-blue-700">{value}</span>
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-blue-600"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="mt-3 text-sm text-slate-500">{progress}% completed</p>
    </Card>
  );
}