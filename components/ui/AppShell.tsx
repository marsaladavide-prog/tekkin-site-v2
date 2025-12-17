import type { ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  fullHeight?: boolean;
  maxWidth?: "default" | "full";
};

export default function AppShell({
  children,
  className = "",
  innerClassName = "",
  fullHeight = false,
  maxWidth = "default",
}: AppShellProps) {
  const outerClasses = [
    "w-full bg-[var(--bg)] text-[var(--text)]",
    fullHeight ? "min-h-full" : "min-h-screen",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const widthClass = maxWidth === "full" ? "max-w-full" : "max-w-6xl";

  return (
    <div className={outerClasses}>
      <div
        className={[
          "mx-auto flex w-full flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8",
          widthClass,
          innerClassName,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {children}
      </div>
    </div>
  );
}
