export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="h-8 w-56 animate-pulse rounded-xl bg-slate-200" />
        <div className="h-4 w-full max-w-2xl animate-pulse rounded-xl bg-slate-200" />

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="h-12 w-12 animate-pulse rounded-2xl bg-slate-200" />
              <div className="mt-4 h-5 w-3/4 animate-pulse rounded-xl bg-slate-200" />
              <div className="mt-3 h-4 w-full animate-pulse rounded-xl bg-slate-200" />
              <div className="mt-6 h-2 w-full animate-pulse rounded-full bg-slate-200" />
              <div className="mt-5 h-10 w-full animate-pulse rounded-xl bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}