"use client";

import React from "react";

type ProfileKeySelectorProps = {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  className?: string;
};

export default function ProfileKeySelector({
  value,
  options,
  onChange,
  className,
}: ProfileKeySelectorProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={
        className ??
        "rounded-xl bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text-primary)]"
      }
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
