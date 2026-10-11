import Link from "next/link";
import { ChevronRight } from "lucide-react";

export default function Breadcrumbs({ items = [] }) {
  if (!items.length) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-sm">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <div key={`${item.label}-${index}`} className="flex items-center gap-2">
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="font-medium text-slate-500 transition hover:text-slate-900"
              >
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "font-medium text-slate-900" : "text-slate-500"}>
                {item.label}
              </span>
            )}

            {!isLast ? <ChevronRight className="h-4 w-4 text-slate-400" /> : null}
          </div>
        );
      })}
    </nav>
  );
}