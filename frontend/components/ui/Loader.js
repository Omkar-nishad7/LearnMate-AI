export default function Loader({ className = "" }) {
  return (
    <div
      className={`inline-flex h-10 w-10 animate-spin items-center justify-center rounded-full border-2 border-slate-200 border-t-blue-600 ${className}`}
      aria-label="Loading"
    />
  );
}