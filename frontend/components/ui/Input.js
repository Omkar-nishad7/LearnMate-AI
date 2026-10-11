import { cn } from "@/lib/utils";

export default function Input({
  className = "",
  type = "text",
  ...props
}) {
  return (
    <input
      type={type}
      className={cn("input-ui", className)}
      {...props}
    />
  );
}