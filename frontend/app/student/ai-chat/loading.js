export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="h-8 w-40 animate-pulse rounded-xl bg-slate-200" />
        <div className="h-4 w-full max-w-2xl animate-pulse rounded-xl bg-slate-200" />

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="h-16 border-b border-slate-200 px-5 py-4">
            <div className="h-5 w-48 animate-pulse rounded-xl bg-slate-200" />
          </div>

          <div className="space-y-4 px-5 py-5">
            <div className="flex gap-3">
              <div className="h-9 w-9 animate-pulse rounded-full bg-slate-200" />
              <div className="h-12 w-2/3 animate-pulse rounded-2xl bg-slate-200" />
            </div>
            <div className="flex justify-end gap-3">
              <div className="h-12 w-1/2 animate-pulse rounded-2xl bg-slate-200" />
              <div className="h-9 w-9 animate-pulse rounded-full bg-slate-200" />
            </div>
            <div className="flex gap-3">
              <div className="h-9 w-9 animate-pulse rounded-full bg-slate-200" />
              <div className="h-10 w-3/4 animate-pulse rounded-2xl bg-slate-200" />
            </div>
          </div>

          <div className="border-t border-slate-200 p-4">
            <div className="h-14 animate-pulse rounded-2xl bg-slate-200" />
          </div>
        </div>
      </div>
    </main>
  );
}