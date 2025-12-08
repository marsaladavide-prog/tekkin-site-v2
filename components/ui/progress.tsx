"use client";

import * as React from "react";

export interface ProgressProps
  extends React.HTMLAttributes<HTMLDivElement> {
  value?: number; // 0 - 100
  max?: number;   // default 100
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, ...props }, ref) => {
    const safeMax = max || 100;
    const clamped = Math.min(Math.max(value ?? 0, 0), safeMax);
    const percent = (clamped / safeMax) * 100;

    const outerClasses =
      "relative h-1.5 w-full overflow-hidden rounded-full bg-zinc-900/80 " +
      (className ?? "");

    return (
      <div
        ref={ref}
        className={outerClasses}
        {...props}
      >
        <div
          className="h-full w-full origin-left rounded-full bg-emerald-400 transition-transform duration-300 ease-out"
          style={{ transform: `scaleX(${percent / 100})` }}
        />
      </div>
    );
  }
);

Progress.displayName = "Progress";

export { Progress };
