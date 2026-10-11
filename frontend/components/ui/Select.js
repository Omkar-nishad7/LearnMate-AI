import { cn } from "@/lib/utils";

export default function Select({
  className = "",
  children,
  ...props
}) {
  return (
    <select
      className={cn("input-ui", className)}
      {...props}
    >
      {children}
    </select>
  );
}