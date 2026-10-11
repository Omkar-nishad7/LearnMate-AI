import { UserCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Avatar({
  name = "",
  src = "",
  alt = "",
  className = ""
}) {
  const initial = name?.trim()?.charAt(0)?.toUpperCase() || "U";

  return (
    <div
      className={cn(
        "flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-blue-50 text-blue-700",
        className
      )}
    >
      {src ? (
        <img src={src} alt={alt || name || "Avatar"} className="h-full w-full object-cover" />
      ) : name ? (
        <span className="text-sm font-semibold">{initial}</span>
      ) : (
        <UserCircle2 className="h-5 w-5" />
      )}
    </div>
  );
}