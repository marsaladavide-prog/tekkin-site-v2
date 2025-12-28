"use client";

import clsx from "clsx";
import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";

type SoftButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "accent";
  href?: string;
};

const variantClass: Record<NonNullable<SoftButtonProps["variant"]>, string> = {
  default:
    "border border-[var(--border)] bg-[var(--panel-soft)] text-[var(--text)] hover:border-[var(--accent)] hover:bg-[var(--panel)] focus-visible:border-[var(--accent)] focus-visible:ring focus-visible:ring-[var(--accent-soft)]/60",
  accent:
    "border-transparent bg-[var(--accent)] text-black shadow-[0_10px_40px_rgba(249,115,22,0.3)] hover:bg-[#ff8b3c] focus-visible:outline-none focus-visible:ring focus-visible:ring-[var(--accent-soft)]/60",
};

export default function SoftButton({
  className,
  variant = "default",
  type = "button",
  href,
  ...props
}: SoftButtonProps) {
  return (
    <>
      {href ? (
        <Link
          href={href}
          className={clsx(
            "inline-flex items-center justify-center rounded-pill px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.3em] transition focus-visible:outline-none",
            variantClass[variant],
            className
          )}
          {...(props as AnchorHTMLAttributes<HTMLAnchorElement>)}
        />
      ) : (
        <button
          type={type}
          className={clsx(
            "inline-flex items-center justify-center rounded-pill px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.3em] transition focus-visible:outline-none",
            variantClass[variant],
            className
          )}
          {...props}
        />
      )}
    </>
  );
}
