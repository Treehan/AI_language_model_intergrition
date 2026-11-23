import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "outline" | "destructive" | "success";
}

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  const variants: Record<NonNullable<BadgeProps["variant"]>, string> = {
    default: "bg-slate-900 text-white",
    secondary: "bg-slate-100 text-slate-800",
    outline: "border border-slate-300 text-slate-700",
    destructive: "bg-rose-100 text-rose-800 border border-rose-200",
    success: "bg-emerald-100 text-emerald-800 border border-emerald-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
