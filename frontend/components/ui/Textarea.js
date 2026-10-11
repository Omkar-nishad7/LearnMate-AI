import { cn } from "@/lib/utils";

export default function Textarea({
  className = "",
  ...props
}) {
  return (
    <textarea
      className={cn("input-ui min-h-32", className)}
      {...props}
    />
  );
}