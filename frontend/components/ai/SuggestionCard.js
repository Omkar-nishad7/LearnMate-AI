import Card from "@/components/ui/Card";

export default function SuggestionCard({ title, text, onClick }) {
  return (
    <Card className="p-4">
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="btn-secondary mt-4 w-full"
        >
          Use Suggestion
        </button>
      ) : null}
    </Card>
  );
}