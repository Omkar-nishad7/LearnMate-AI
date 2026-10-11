export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="container-page py-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} LearnMate AI. All rights reserved.
          </p>
          <p className="text-sm text-slate-500">
            Built for students and teachers
          </p>
        </div>
      </div>
    </footer>
  );
}