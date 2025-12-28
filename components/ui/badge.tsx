import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variant === "default" && "bg-white/10 text-white",
        variant === "secondary" && "bg-white/5 text-white/80",
        variant === "outline" && "border border-white/10 text-white/70",
        variant === "destructive" && "bg-red-500/15 text-red-200 border border-red-500/20",
        className
      )}
      {...props}
    />
  );
}
