export default function AuthLayout({ title, description, children }) {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="container-page flex min-h-screen items-center justify-center py-10">
        <div className="w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card">
          <div className="grid lg:grid-cols-2">
            <div className="hidden bg-blue-600 p-10 text-white lg:flex lg:flex-col lg:justify-between">
              <div>
                <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
                {description ? (
                  <p className="mt-4 max-w-md text-white/80">{description}</p>
                ) : null}
              </div>
            </div>

            <div className="p-6 sm:p-10">{children}</div>
          </div>
        </div>
      </div>
    </main>
  );
}