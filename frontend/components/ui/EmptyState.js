import Card from "@/components/ui/Card";

export default function EmptyState({
  title = "No data found",
  description = "There is nothing to show right now.",
  action
}) {
  return (
    <Card className="p-8 text-center">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </Card>
  );
}