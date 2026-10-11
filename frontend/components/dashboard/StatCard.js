import Card from "@/components/ui/Card";

export default function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  color = "blue",
}) {
  const iconBg =
    color === "green"
      ? "bg-emerald-50 text-emerald-700"
      : color === "purple"
        ? "bg-violet-50 text-violet-700"
        : color === "amber"
          ? "bg-amber-50 text-amber-700"
          : "bg-blue-50 text-blue-700";

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <h3 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            {value}
          </h3>
        </div>
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${iconBg}`}
        >
          {Icon ? <Icon className="h-6 w-6" /> : null}
        </div>
      </div>
      {trend ? <p className="mt-4 text-sm text-slate-500">{trend}</p> : null}
    </Card>
  );
}
