export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="card-ui flex items-center gap-3 px-5 py-4">
        <div className="h-4 w-4 animate-pulse rounded-full bg-blue-600" />
        <p className="text-sm font-medium text-slate-600">Loading LearnMate AI...</p>
      </div>
    </main>
  );
}