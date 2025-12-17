"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

type SidebarNavItemProps = {
  href: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  nested?: boolean;
};

export default function SidebarNavItem({
  href,
  label,
  icon: Icon,
  active = false,
  nested = false,
}: SidebarNavItemProps) {
  const baseClasses = [
    "flex items-center gap-3 rounded-full px-3 py-2 text-sm font-semibold transition",
    nested ? "ml-4" : "",
    active
      ? "bg-white/10 text-white"
      : "text-white/60 hover:bg-white/5 hover:text-white",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Link
      href={href}
      className={baseClasses}
      aria-current={active ? "page" : undefined}
    >
      <Icon
        className={["h-5 w-5 transition", active ? "text-white" : "text-white/70"].join(" ")}
        aria-hidden
      />
      <span>{label}</span>
    </Link>
  );
}
