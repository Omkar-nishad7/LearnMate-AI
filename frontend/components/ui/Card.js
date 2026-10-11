import { cn } from "@/lib/utils";

export default function Card({ className = "", children, ...props }) {
  return (
    <div
      className={cn("card-ui", className)}
      {...props}
    >
      {children}
    </div>
  );
}